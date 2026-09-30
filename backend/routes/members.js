const express=require("express");
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const Member=require("../models/Member");
const User=require("../models/User");
const Scheme=require("../models/Scheme");
const Ticket=require("../models/MemberSchemeTicket");
const {requireAuth,requireRole}=require("../middleware/auth");
const {isManager,userMemberIds}=require("../middleware/tenant");
const {sendMemberCredentials}=require("../services/mail");
const router=express.Router();
const clean=m=>{const x=m.toObject();x.id=x._id.toString();delete x._id;delete x.__v;return x;};

router.get("/",requireAuth,async(req,res)=>{
  if(req.user.role==="user"){
    const rows=await Member.find({_id:{$in:userMemberIds(req.user)}}).sort({createdAt:-1});
    return res.json({success:true,members:rows.map(clean)});
  }
  const rows=await Member.find({manager:req.user._id}).sort({createdAt:-1});
  const memberIds=rows.map(m=>m._id);
  const linked=await User.find({role:"user",$or:[{memberId:{$in:memberIds}},{memberIds:{$in:memberIds}}]}).select("memberId memberIds").lean();
  const linkedIds=new Set(linked.flatMap(user=>[user.memberId,...(user.memberIds||[])].filter(Boolean).map(String)));
  res.json({success:true,members:rows.map(m=>({...clean(m),hasLogin:linkedIds.has(String(m._id))}))});
});
router.get("/:id",requireAuth,async(req,res)=>{
  const linkedIds=userMemberIds(req.user).map(String);
  if(!isManager(req.user)&&!linkedIds.includes(req.params.id))return res.status(404).json({success:false,message:"Member not found"});
  const filter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.params.id};
  const m=await Member.findOne(filter); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  res.json({success:true,member:clean(m)});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const b=req.body; if(!b.name||!b.email||!b.phone||!b.joinedDate)return res.status(400).json({success:false,message:"Name, email, phone and joined date are required"});
  const email=String(b.email).trim().toLowerCase();
  const phone=String(b.phone).trim();
  if(!/^\d{10}$/.test(phone))return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits"});
  if(await Member.exists({manager:req.user._id,$or:[{email},{phone}]}))return res.status(409).json({success:false,message:"A member with this email or phone already exists in your account"});
  if(await User.exists({role:{$in:["manager","admin"]},$or:[{email},{phone}]}))return res.status(409).json({success:false,message:"This email or phone is already used by a manager"});
  const existingLogin=await User.findOne({role:"user",$or:[{email},{phone}]});
  if(existingLogin&&(existingLogin.email!==email||existingLogin.phone!==phone))return res.status(409).json({success:false,message:"This email or phone is linked to a different member login"});
  const member=await Member.create({manager:req.user._id,name:String(b.name).trim(),email,phone,joinedDate:b.joinedDate,status:b.status||"active",profilePhoto:b.profilePhoto||""});
  if(existingLogin){
    const ids=userMemberIds(existingLogin);
    if(!ids.some(id=>String(id)===String(member._id))){existingLogin.memberIds=[...ids,member._id];if(!existingLogin.memberId)existingLogin.memberId=member._id;await existingLogin.save();}
    else if(!existingLogin.memberIds?.length){existingLogin.memberIds=ids;await existingLogin.save();}
  }
  res.status(201).json({success:true,member:clean(member),hasLogin:Boolean(existingLogin)});
});

router.post("/:id/account",requireAuth,requireRole("admin"),async(req,res)=>{
  const member=await Member.findOne({_id:req.params.id,manager:req.user._id});
  if(!member)return res.status(404).json({success:false,message:"Member not found"});
  let user=await User.findOne({role:"user",$or:[{email:member.email},{phone:member.phone},{memberId:member._id},{memberIds:member._id}]});
  if(user){
    if(user.email!==member.email||user.phone!==member.phone)return res.status(409).json({success:false,message:"This email or phone belongs to a different member login."});
    const ids=userMemberIds(user);
    if(!ids.some(id=>String(id)===String(member._id))){
      user.memberIds=[...ids,member._id];
      if(!user.memberId)user.memberId=member._id;
      await user.save();
    } else if(!user.memberIds?.length){user.memberIds=ids;await user.save();}
    return res.json({success:true,message:"This member is linked to the existing login. They can use the same account to access this manager's schemes.",user:{id:user._id.toString(),username:user.username,email:user.email,role:user.role,memberId:(user.memberId||member._id).toString(),memberIds:user.memberIds.map(String)}});
  }
  if(!process.env.SMTP_HOST||!process.env.SMTP_PORT||!process.env.SMTP_USER||!process.env.SMTP_PASSWORD)return res.status(503).json({success:false,message:"SMTP is not configured. Add the SMTP credentials before creating member logins."});
  if(await User.exists({$or:[{email:member.email},{phone:member.phone}]}))return res.status(409).json({success:false,message:"This email or phone is already assigned to another login."});
  const stem=member.name.toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"").slice(0,32)||"member";
  let username;
  for(let i=0;i<5;i++){
    username=`${stem}.${crypto.randomBytes(3).toString("hex")}`;
    if(!await User.exists({username}))break;
    username=null;
  }
  if(!username)return res.status(500).json({success:false,message:"Could not generate a unique username. Try again."});
  const temporaryPassword=crypto.randomBytes(12).toString("base64url");
  try{
    user=await User.create({fullName:member.name,username,email:member.email,phone:member.phone,passwordHash:await bcrypt.hash(temporaryPassword,12),role:"user",memberId:member._id,memberIds:[member._id],mustChangePassword:true});
    await sendMemberCredentials({to:member.email,name:member.name,username,temporaryPassword});
  }catch(error){
    if(user)await User.deleteOne({_id:user._id});
    if(error.code===11000)return res.status(409).json({success:false,message:"This email, phone or username is already assigned to another login."});
    return res.status(503).json({success:false,message:"Could not send the member login email. Check SMTP settings and try again."});
  }
  res.status(201).json({success:true,message:`Login details were emailed to ${member.email}.`,user:{id:user._id.toString(),username:user.username,email:user.email,role:user.role,memberId:member._id.toString(),memberIds:[member._id.toString()]}});
});
router.patch("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const allowed=["name","email","phone","joinedDate","status","profilePhoto"]; const b={}; allowed.forEach(k=>{if(req.body[k]!==undefined)b[k]=req.body[k]});
  if(b.email!==undefined)b.email=String(b.email).trim().toLowerCase();
  if(b.phone!==undefined)b.phone=String(b.phone).trim();
  const current=await Member.findOne({_id:req.params.id,manager:req.user._id}); if(!current)return res.status(404).json({success:false,message:"Member not found"});
  const linkedUser=await User.findOne({role:"user",$or:[{memberId:current._id},{memberIds:current._id}]});
  const identity={}; if(b.email!==undefined)identity.email=b.email; if(b.phone!==undefined)identity.phone=b.phone;
  const linkedIds=linkedUser?userMemberIds(linkedUser):[current._id];
  const linkedRows=linkedUser?await Member.find({_id:{$in:linkedIds}}).select("_id manager").lean():[{_id:current._id,manager:req.user._id}];
  const managers=[...new Set(linkedRows.map(row=>String(row.manager)))];
  if(Object.keys(identity).length&&await Member.exists({manager:{$in:managers},_id:{$nin:linkedIds},$or:Object.entries(identity).map(([key,value])=>({[key]:value}))}))return res.status(409).json({success:false,message:"Another member already uses this email or phone in one of the linked manager accounts"});
  if(Object.keys(identity).length&&await User.exists({_id:{$ne:linkedUser?._id||null},$or:Object.entries(identity).map(([key,value])=>({[key]:value}))}))return res.status(409).json({success:false,message:"This email or phone is already used by another login"});
  const m=await Member.findOneAndUpdate({_id:req.params.id,manager:req.user._id},b,{new:true,runValidators:true}); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  if(linkedUser){
    linkedUser.fullName=m.name;linkedUser.email=m.email;linkedUser.phone=m.phone;linkedUser.profilePhoto=m.profilePhoto||"";await linkedUser.save();
    await Member.updateMany({_id:{$in:linkedIds.filter(id=>String(id)!==String(m._id))}},{name:m.name,email:m.email,phone:m.phone,profilePhoto:m.profilePhoto||""},{runValidators:true});
  }
  res.json({success:true,member:clean(m)});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const m=await Member.findOne({_id:req.params.id,manager:req.user._id}); if(!m)return res.status(404).json({success:false,message:"Member not found"});
  const has=await Ticket.exists({member:m._id}); if(has)return res.status(409).json({success:false,message:"Member has scheme tickets and cannot be deleted"});
  const linkedUser=await User.findOne({role:"user",$or:[{memberId:m._id},{memberIds:m._id}]});
  if(linkedUser){
    const remaining=userMemberIds(linkedUser).filter(id=>String(id)!==String(m._id));
    if(!remaining.length)await User.deleteOne({_id:linkedUser._id});
    else {linkedUser.memberIds=remaining;linkedUser.memberId=remaining[0];await linkedUser.save();}
  }
  await Member.deleteOne({_id:m._id});
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
  const linkedIds=userMemberIds(req.user).map(String);
  if(!isManager(req.user)&&!linkedIds.includes(req.params.id))return res.status(404).json({success:false,message:"Member not found"});
  const memberFilter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.params.id};
  const member=await Member.findOne(memberFilter); if(!member)return res.status(404).json({success:false,message:"Member not found"});
  const rows=await Ticket.find({member:member._id}).populate({path:"scheme",populate:{path:"manager",select:"fullName username"}}); res.json({success:true,tickets:rows});
});
module.exports=router;
