const express=require("express");
const bcrypt=require("bcryptjs");
const User=require("../models/User");
const Member=require("../models/Member");
const {requireAuth,signUser}=require("../middleware/auth");
const router=express.Router();

const safe=u=>({id:u._id.toString(),fullName:u.fullName,username:u.username,email:u.email,phone:u.phone,role:u.role,memberId:u.memberId?u.memberId.toString():null,profilePhoto:u.profilePhoto||"",lastLogin:u.lastLogin});

router.post("/register",async(req,res)=>{
  try{
    const {fullName,username,email,phone,password,confirmPassword}=req.body;
    if(!fullName||!username||!email||!phone||!password) return res.status(400).json({success:false,message:"All fields are required"});
    if(confirmPassword!==undefined && password!==confirmPassword) return res.status(400).json({success:false,message:"Passwords do not match"});
    if(!/^\d{10}$/.test(phone)) return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits"});
    if(!/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/.test(email)) return res.status(400).json({success:false,message:"Invalid email address"});
    if(password.length<8) return res.status(400).json({success:false,message:"Password must contain at least 8 characters"});
    if(await User.findOne({$or:[{username:username.trim()},{email:email.toLowerCase()},{phone}]})) return res.status(409).json({success:false,message:"Username, email or phone already exists"});
    const user=await User.create({fullName:fullName.trim(),username:username.trim(),email:email.toLowerCase(),phone,passwordHash:await bcrypt.hash(password,12),role:"admin",memberId:null});
    res.status(201).json({success:true,message:"Admin account created",token:signUser(user),user:safe(user)});
  }catch(e){res.status(400).json({success:false,message:e.message});}
});

router.post("/admin/login",async(req,res)=>{
  try{
    const {username,password}=req.body; const user=await User.findOne({username:username?.trim(),role:"admin"});
    if(!user||!(await bcrypt.compare(password||"",user.passwordHash))) return res.status(401).json({success:false,message:"Invalid admin username or password"});
    user.lastLogin=new Date(); await user.save();
    res.json({success:true,token:signUser(user),user:safe(user)});
  }catch(e){res.status(500).json({success:false,message:e.message});}
});

router.post("/user/login",async(req,res)=>{
  try{
    const {username,password}=req.body; const user=await User.findOne({username:username?.trim(),role:"user"});
    if(!user||!(await bcrypt.compare(password||"",user.passwordHash))) return res.status(401).json({success:false,message:"Invalid username or password"});
    if(!user.memberId) return res.status(403).json({success:false,message:"User account is not linked to a member"});
    const member=await Member.findById(user.memberId); if(!member) return res.status(403).json({success:false,message:"Linked member not found"});
    user.lastLogin=new Date(); await user.save();
    res.json({success:true,token:signUser(user),user:safe(user),member:{id:member._id.toString(),name:member.name,email:member.email,phone:member.phone,status:member.status,profilePhoto:member.profilePhoto}});
  }catch(e){res.status(500).json({success:false,message:e.message});}
});


router.patch("/profile",requireAuth,async(req,res)=>{
  try{
    const fields={};
    for(const k of ["fullName","email","phone","profilePhoto"]) if(req.body[k]!==undefined) fields[k]=req.body[k];
    if(fields.phone!==undefined&&!/^\d{10}$/.test(fields.phone)) return res.status(400).json({success:false,message:"Phone must be exactly 10 digits"});
    const u=await User.findByIdAndUpdate(req.user._id,fields,{new:true,runValidators:true});
    if(u?.role==="user"&&u.memberId) await Member.findByIdAndUpdate(u.memberId,{name:u.fullName,email:u.email,phone:u.phone,profilePhoto:u.profilePhoto||""},{runValidators:true});
    res.json({success:true,user:safe(u)});
  }catch(e){res.status(400).json({success:false,message:e.message});}
});
router.patch("/password",requireAuth,async(req,res)=>{
  const {currentPassword,newPassword}=req.body;
  if(!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:"New password must contain at least 8 characters"});
  if(!(await bcrypt.compare(currentPassword||"",req.user.passwordHash)))return res.status(400).json({success:false,message:"Current password is incorrect"});
  req.user.passwordHash=await bcrypt.hash(newPassword,12);await req.user.save();res.json({success:true,message:"Password changed"});
});

router.get("/me",requireAuth,async(req,res)=>res.json({success:true,user:safe(req.user)}));
router.post("/logout",requireAuth,(req,res)=>res.json({success:true,message:"Logged out. Remove the token on the client."}));
module.exports=router;
