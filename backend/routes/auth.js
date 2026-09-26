const express=require("express");
const bcrypt=require("bcryptjs");
const crypto=require("crypto");
const User=require("../models/User");
const Member=require("../models/Member");
const PasswordReset=require("../models/PasswordReset");
const {requireAuth,requireRole,signUser}=require("../middleware/auth");
const {smtpConfigured,sendMemberCredentials,sendPasswordResetOtp}=require("../services/mail");
const router=express.Router();

const safe=u=>({id:u._id.toString(),fullName:u.fullName,username:u.username,email:u.email,phone:u.phone,role:u.role,memberId:u.memberId?u.memberId.toString():null,profilePhoto:u.profilePhoto||"",lastLogin:u.lastLogin,mustChangePassword:Boolean(u.mustChangePassword)});

router.post("/register",async(req,res)=>{
  try{
    const {fullName,username,email,phone,password,confirmPassword}=req.body;
    if(!fullName||!username||!email||!phone||!password) return res.status(400).json({success:false,message:"All fields are required"});
    if(confirmPassword!==undefined && password!==confirmPassword) return res.status(400).json({success:false,message:"Passwords do not match"});
    if(!/^\d{10}$/.test(phone)) return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits"});
    if(!/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/.test(email)) return res.status(400).json({success:false,message:"Invalid email address"});
    if(password.length<8) return res.status(400).json({success:false,message:"Password must contain at least 8 characters"});
    if(await Member.exists({$or:[{email:email.toLowerCase()},{phone}]}))return res.status(409).json({success:false,message:"This email or phone is already used by a member"});
    if(await User.findOne({$or:[{username:username.trim()},{email:email.toLowerCase()},{phone}]})) return res.status(409).json({success:false,message:"Username, email or phone already exists"});
    const user=await User.create({fullName:fullName.trim(),username:username.trim(),email:email.toLowerCase(),phone,passwordHash:await bcrypt.hash(password,12),role:"manager",memberId:null});
    res.status(201).json({success:true,message:"Manager account created",token:signUser(user),user:safe(user)});
  }catch(e){
    if (e.code === 11000) return res.status(409).json({success:false,message:"Username, email or phone already exists"});
    res.status(400).json({success:false,message:e.name === "ValidationError" ? e.message : "Unable to create manager account"});
  }
});

// Existing managers can provision another manager from the dashboard.
router.post("/managers",requireAuth,requireRole("admin"),async(req,res)=>{
  try{
    const {fullName,username,email,phone,password,confirmPassword}=req.body;
    if(!fullName||!username||!email||!phone||!password)return res.status(400).json({success:false,message:"All fields are required"});
    if(confirmPassword!==undefined&&password!==confirmPassword)return res.status(400).json({success:false,message:"Passwords do not match"});
    if(!/^\d{10}$/.test(phone))return res.status(400).json({success:false,message:"Phone number must be exactly 10 digits"});
    if(!/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/.test(email))return res.status(400).json({success:false,message:"Invalid email address"});
    if(password.length<8)return res.status(400).json({success:false,message:"Password must contain at least 8 characters"});
    if(await Member.exists({$or:[{email:email.toLowerCase()},{phone}]}))return res.status(409).json({success:false,message:"This email or phone is already used by a member"});
    if(await User.findOne({$or:[{username:username.trim()},{email:email.toLowerCase()},{phone}]}))return res.status(409).json({success:false,message:"Username, email or phone already exists"});
    const user=await User.create({fullName:fullName.trim(),username:username.trim(),email:email.toLowerCase(),phone,passwordHash:await bcrypt.hash(password,12),role:"manager",memberId:null});
    return res.status(201).json({success:true,message:"Manager account created",user:safe(user)});
  }catch(e){
    if(e.code===11000)return res.status(409).json({success:false,message:"Username, email or phone already exists"});
    return res.status(400).json({success:false,message:e.name==="ValidationError"?e.message:"Unable to create manager account"});
  }
});

const managerLogin=async(req,res)=>{
  try{
    const {username,password}=req.body; const user=await User.findOne({username:username?.trim(),role:{$in:["manager","admin"]}});
    if(!user||!(await bcrypt.compare(password||"",user.passwordHash))) return res.status(401).json({success:false,message:"Invalid manager username or password"});
    user.lastLogin=new Date(); await user.save();
    res.json({success:true,token:signUser(user),user:safe(user)});
  }catch(e){res.status(500).json({success:false,message:e.message});}
};
router.post("/manager/login",managerLogin);
router.post("/admin/login",managerLogin);

router.post("/user/login",async(req,res)=>{
  try{
    const {identifier,email,username,password}=req.body;
    const login=String(identifier||email||username||"").trim();
    const normalizedLogin=login.toLowerCase();
    const user=await User.findOne({role:"user",$or:[{email:normalizedLogin},{username:login},{username:normalizedLogin}]});
    if(!user||!(await bcrypt.compare(password||"",user.passwordHash))) return res.status(401).json({success:false,message:"Invalid email or password"});
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
    if(fields.email!==undefined||fields.phone!==undefined){
      const identity={}; if(fields.email!==undefined)identity.email=String(fields.email).trim().toLowerCase(); if(fields.phone!==undefined)identity.phone=String(fields.phone).trim();
      const duplicate=req.user.role==="user"
        ? await User.exists({role:{$in:["manager","admin"]},$or:Object.entries(identity).map(([key,value])=>({[key]:value}))})
        : await Member.exists({$or:Object.entries(identity).map(([key,value])=>({[key]:value}))});
      if(duplicate)return res.status(409).json({success:false,message:`This email or phone is already used by a ${req.user.role==="user"?"manager":"member"}`});
      if(fields.email!==undefined)fields.email=identity.email; if(fields.phone!==undefined)fields.phone=identity.phone;
    }
    const u=await User.findByIdAndUpdate(req.user._id,fields,{new:true,runValidators:true});
    if(u?.role==="user"&&u.memberId) await Member.findByIdAndUpdate(u.memberId,{name:u.fullName,email:u.email,phone:u.phone,profilePhoto:u.profilePhoto||""},{runValidators:true});
    res.json({success:true,user:safe(u)});
  }catch(e){res.status(400).json({success:false,message:e.message});}
});
router.patch("/password",requireAuth,async(req,res)=>{
  const {currentPassword,newPassword}=req.body;
  if(!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:"New password must contain at least 8 characters"});
  const user=await User.findById(req.user._id);
  if(!(await bcrypt.compare(currentPassword||"",user.passwordHash)))return res.status(400).json({success:false,message:"Current password is incorrect"});
  user.passwordHash=await bcrypt.hash(newPassword,12);await user.save();res.json({success:true,message:"Password changed"});
});

router.post("/password/first-login",requireAuth,async(req,res)=>{
  const {newPassword,confirmPassword}=req.body;
  if(req.user.role!=="user"||!req.user.mustChangePassword)return res.status(409).json({success:false,message:"No temporary password change is required."});
  if(!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:"New password must contain at least 8 characters."});
  if(newPassword!==confirmPassword)return res.status(400).json({success:false,message:"Passwords do not match."});
  const user=await User.findById(req.user._id);
  user.passwordHash=await bcrypt.hash(newPassword,12);
  user.mustChangePassword=false;
  await user.save();
  res.json({success:true,message:"Password updated.",user:safe(user)});
});

const genericResetMessage="If an account matches that email, a password reset code will arrive shortly.";
function otpDigest(userId,otp){return crypto.createHmac("sha256",process.env.JWT_SECRET).update(`${userId}:${otp}`).digest("hex");}
function safeDigestEqual(left,right){
  const a=Buffer.from(String(left||""),"hex"),b=Buffer.from(String(right||""),"hex");
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}

router.post("/password/forgot",async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase();
  if(!/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/.test(email))return res.status(400).json({success:false,message:"Enter a valid email address."});
  if(!smtpConfigured())return res.status(503).json({success:false,message:"Email service is not configured. Contact the manager."});
  const user=await User.findOne({email,role:{$in:["manager","admin","user"]}});
  if(!user)return res.json({success:true,message:genericResetMessage});
  const now=new Date();
  const previous=await PasswordReset.findOne({user:user._id});
  if(previous&&now-previous.createdAt<60_000)return res.json({success:true,message:genericResetMessage});
  const otp=String(crypto.randomInt(100000,1000000));
  await PasswordReset.findOneAndUpdate({user:user._id},{user:user._id,otpHash:otpDigest(user._id,otp),attempts:0,createdAt:now,expiresAt:new Date(now.getTime()+10*60_000)},{upsert:true,new:true,setDefaultsOnInsert:true});
  try{await sendPasswordResetOtp({to:user.email,name:user.fullName,otp});}
  catch(error){await PasswordReset.deleteOne({user:user._id});return res.status(503).json({success:false,message:"Could not send the reset email. Check SMTP settings and try again."});}
  res.json({success:true,message:genericResetMessage});
});

router.post("/password/reset",async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase();
  const otp=String(req.body.otp||"").trim();
  const {newPassword,confirmPassword}=req.body;
  if(!/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/.test(email)||!/^\d{6}$/.test(otp))return res.status(400).json({success:false,message:"Enter the registered email and six-digit code."});
  if(!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:"New password must contain at least 8 characters."});
  if(newPassword!==confirmPassword)return res.status(400).json({success:false,message:"Passwords do not match."});
  const user=await User.findOne({email,role:{$in:["manager","admin","user"]}});
  if(!user)return res.status(400).json({success:false,message:"The reset code is invalid or expired."});
  const reset=await PasswordReset.findOne({user:user._id,expiresAt:{$gt:new Date()},attempts:{$lt:5}});
  if(!reset)return res.status(400).json({success:false,message:"The reset code is invalid or expired."});
  if(!safeDigestEqual(reset.otpHash,otpDigest(user._id,otp))){
    reset.attempts+=1;await reset.save();
    if(reset.attempts>=5)await PasswordReset.deleteOne({_id:reset._id});
    return res.status(400).json({success:false,message:"The reset code is invalid or expired."});
  }
  user.passwordHash=await bcrypt.hash(newPassword,12);
  user.mustChangePassword=false;
  await user.save();
  await PasswordReset.deleteOne({_id:reset._id});
  res.json({success:true,message:"Password reset successfully. You can now sign in."});
});

router.get("/me",requireAuth,async(req,res)=>res.json({success:true,user:safe(req.user)}));
router.post("/logout",requireAuth,(req,res)=>res.json({success:true,message:"Logged out. Remove the token on the client."}));
module.exports=router;
