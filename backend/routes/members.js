const express=require("express");
const bcrypt=require("bcryptjs");
const Member=require("../models/Member");
const User=require("../models/User");
const Scheme=require("../models/Scheme");
const Ticket=require("../models/MemberSchemeTicket");
const {requireAuth,requireRole}=require("../middleware/auth");
const {isManager}=require("../middleware/tenant");
const router=express.Router();
const clean=m=>{const x=m.toObject();x.id=x._id.toString();delete x._id;delete x.__v;return x;};

router.get("/",requireAuth,async(req,res)=>{
  if(req.user.role==="user"){
    const m=await Member.findById(req.user.memberId); return res.json({success:true,members:m?[clean(m)]:[]});
  }
  const rows=await Member.find({manager:req.user._id}).sort({createdAt:-1}); res.json({success:true,members:rows.map(clean)});
});
router.get("/:id",requireAuth,async(req,res)=>{
  if(!isManager(req.user)&&req.user.memberId.toString()!==req.params.id)return res.status(404).json({success:false,message:"Member not found"});
  const filter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.user.memberId};
  const m=await Member.findOne(filter); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  res.json({success:true,member:clean(m)});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const b=req.body; if(!b.name||!b.email||!b.phone||!b.joinedDate)return res.status(400).json({success:false,message:"Name, email, phone and joined date are required"});
  const email=String(b.email).trim().toLowerCase();
  const phone=String(b.phone).trim();
  if(!/^\d{10}$/.test(phone))return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits"});
  if(await Member.exists({$or:[{email},{phone}]}))return res.status(409).json({success:false,message:"A member with this email or phone already exists"});
  if(await User.exists({role:{$in:["manager","admin"]},$or:[{email},{phone}]}))return res.status(409).json({success:false,message:"This email or phone is already used by a manager"});
  const member=await Member.create({manager:req.user._id,name:String(b.name).trim(),email,phone,joinedDate:b.joinedDate,status:b.status||"active",profilePhoto:b.profilePhoto||""});
  let user=null;
  if(b.createLogin!==false && b.password){
    const username=String(b.username||member.email).trim();
    if(await User.findOne({$or:[{username},{email:member.email},{phone:member.phone}]})){await Member.findByIdAndDelete(member._id);return res.status(409).json({success:false,message:"A login already exists for this email or phone"});}
    user=await User.create({fullName:member.name,username,email:member.email,phone:member.phone,passwordHash:await bcrypt.hash(b.password,12),role:"user",memberId:member._id});
  }
  res.status(201).json({success:true,member:clean(member),user:user?{id:user._id.toString(),username:user.username,role:user.role,memberId:member._id.toString()}:null});
});
router.patch("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const allowed=["name","email","phone","joinedDate","status","profilePhoto"]; const b={}; allowed.forEach(k=>{if(req.body[k]!==undefined)b[k]=req.body[k]});
  if(b.email!==undefined)b.email=String(b.email).trim().toLowerCase();
  if(b.phone!==undefined)b.phone=String(b.phone).trim();
  const identity={}; if(b.email!==undefined)identity.email=b.email; if(b.phone!==undefined)identity.phone=b.phone;
  if(Object.keys(identity).length&&await Member.exists({_id:{$ne:req.params.id},$or:Object.entries(identity).map(([key,value])=>({[key]:value}))}))return res.status(409).json({success:false,message:"Another member already uses this email or phone"});
  if(Object.keys(identity).length&&await User.exists({role:{$in:["manager","admin"]},$or:Object.entries(identity).map(([key,value])=>({[key]:value}))}))return res.status(409).json({success:false,message:"This email or phone is already used by a manager"});
  const m=await Member.findOneAndUpdate({_id:req.params.id,manager:req.user._id},b,{new:true,runValidators:true}); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  await User.updateMany({memberId:m._id},{fullName:m.name,email:m.email,phone:m.phone,profilePhoto:m.profilePhoto||""});
  res.json({success:true,member:clean(m)});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const m=await Member.findOne({_id:req.params.id,manager:req.user._id}); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  const has=await Ticket.exists({member:m._id}); if(has)return res.status(409).json({success:false,message:"Member has scheme tickets and cannot be deleted"});
  await User.deleteMany({memberId:m._id}); await Member.deleteOne({_id:m._id});
  res.json({success:true});
});
router.post("/:id/tickets",requireAuth,requireRole("admin"),async(req,res)=>{
  const {schemeId,ticketNumber}=req.body; if(!schemeId||!ticketNumber)return res.status(400).json({success:false,message:"schemeId and ticketNumber are required"});
  const [member,scheme]=await Promise.all([Member.findOne({_id:req.params.id,manager:req.user._id}),Scheme.findOne({_id:schemeId,manager:req.user._id})]);
  if(!member||!scheme)return res.status(404).json({success:false,message:"Member or scheme not found"});
  const exists=await Ticket.exists({scheme:scheme._id,ticketNumber:String(ticketNumber).trim()}); if(exists)return res.status(409).json({success:false,message:"Ticket number already exists in this scheme"}); const count=await Ticket.countDocuments({scheme:scheme._id}); if(count>=scheme.capacity)return res.status(409).json({success:false,message:"Scheme member capacity is full"});
  const normal=scheme.chitType==="gold"?Number(scheme.baseAmount||0):Math.round(Number(scheme.totalAmount||0)*.05);
  const row=await Ticket.create({member:member._id,scheme:scheme._id,ticketNumber:String(ticketNumber).trim(),chitAmount:scheme.totalAmount||0,normalPayment:normal,takenPayment:scheme.takenPayment||0});
  res.status(201).json({success:true,ticket:row});
});
router.get("/:id/tickets",requireAuth,async(req,res)=>{
  if(!isManager(req.user)&&req.user.memberId.toString()!==req.params.id)return res.status(404).json({success:false,message:"Member not found"});
  const memberFilter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.user.memberId};
  const member=await Member.findOne(memberFilter); if(!member)return res.status(404).json({success:false,message:"Member not found"});
  const rows=await Ticket.find({member:member._id}).populate("scheme"); res.json({success:true,tickets:rows});
});
module.exports=router;
