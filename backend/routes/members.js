const express=require("express");
const bcrypt=require("bcryptjs");
const Member=require("../models/Member");
const User=require("../models/User");
const Scheme=require("../models/Scheme");
const Ticket=require("../models/MemberSchemeTicket");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();
const clean=m=>{const x=m.toObject();x.id=x._id.toString();delete x._id;delete x.__v;return x;};

router.get("/",requireAuth,async(req,res)=>{
  if(req.user.role==="user"){
    const m=await Member.findById(req.user.memberId); return res.json({success:true,members:m?[clean(m)]:[]});
  }
  const rows=await Member.find().sort({createdAt:-1}); res.json({success:true,members:rows.map(clean)});
});
router.get("/:id",requireAuth,async(req,res)=>{
  if(req.user.role==="user"&&req.user.memberId.toString()!==req.params.id)return res.status(403).json({success:false,message:"Access denied"});
  const m=await Member.findById(req.params.id); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  res.json({success:true,member:clean(m)});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const b=req.body; if(!b.name||!b.email||!b.phone||!b.joinedDate)return res.status(400).json({success:false,message:"Name, email, phone and joined date are required"});
  const member=await Member.create({name:b.name,email:b.email,phone:b.phone,joinedDate:b.joinedDate,status:b.status||"active",profilePhoto:b.profilePhoto||""});
  let user=null;
  if(b.createLogin!==false && b.username && b.password){
    if(await User.findOne({$or:[{username:b.username},{email:b.email.toLowerCase()},{phone:b.phone}]})){await Member.findByIdAndDelete(member._id);return res.status(409).json({success:false,message:"User credentials already exist"});}
    user=await User.create({fullName:member.name,username:b.username,email:member.email,phone:member.phone,passwordHash:await bcrypt.hash(b.password,12),role:"user",memberId:member._id});
  }
  res.status(201).json({success:true,member:clean(member),user:user?{id:user._id.toString(),username:user.username,role:user.role,memberId:member._id.toString()}:null});
});
router.patch("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const allowed=["name","email","phone","joinedDate","status","profilePhoto"]; const b={}; allowed.forEach(k=>{if(req.body[k]!==undefined)b[k]=req.body[k]});
  const m=await Member.findByIdAndUpdate(req.params.id,b,{new:true,runValidators:true}); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  await User.updateMany({memberId:m._id},{fullName:m.name,email:m.email,phone:m.phone,profilePhoto:m.profilePhoto||""});
  res.json({success:true,member:clean(m)});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const has=await Ticket.exists({member:req.params.id}); if(has)return res.status(409).json({success:false,message:"Member has scheme tickets and cannot be deleted"});
  await User.deleteMany({memberId:req.params.id}); const m=await Member.findByIdAndDelete(req.params.id); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  res.json({success:true});
});
router.post("/:id/tickets",requireAuth,requireRole("admin"),async(req,res)=>{
  const {schemeId,ticketNumber}=req.body; if(!schemeId||!ticketNumber)return res.status(400).json({success:false,message:"schemeId and ticketNumber are required"});
  const [member,scheme]=await Promise.all([Member.findById(req.params.id),Scheme.findById(schemeId)]);
  if(!member||!scheme)return res.status(404).json({success:false,message:"Member or scheme not found"});
  const exists=await Ticket.exists({scheme:scheme._id,ticketNumber:String(ticketNumber).trim()}); if(exists)return res.status(409).json({success:false,message:"Ticket number already exists in this scheme"}); const count=await Ticket.countDocuments({scheme:scheme._id}); if(count>=scheme.capacity)return res.status(409).json({success:false,message:"Scheme member capacity is full"});
  const normal=scheme.chitType==="gold"?Number(scheme.baseAmount||0):Math.round(Number(scheme.totalAmount||0)*.05);
  const row=await Ticket.create({member:member._id,scheme:scheme._id,ticketNumber:String(ticketNumber).trim(),chitAmount:scheme.totalAmount||0,normalPayment:normal,takenPayment:scheme.takenPayment||0});
  res.status(201).json({success:true,ticket:row});
});
router.get("/:id/tickets",requireAuth,async(req,res)=>{
  if(req.user.role==="user"&&req.user.memberId.toString()!==req.params.id)return res.status(403).json({success:false,message:"Access denied"});
  const rows=await Ticket.find({member:req.params.id}).populate("scheme"); res.json({success:true,tickets:rows});
});
module.exports=router;
