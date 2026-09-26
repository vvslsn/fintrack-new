const express=require("express");
const Notification=require("../models/Notification");
const {requireAuth,requireRole}=require("../middleware/auth");
const Member=require("../models/Member");
const {isManager}=require("../middleware/tenant");
const router=express.Router();
router.get("/",requireAuth,async(req,res)=>{
  const filter=isManager(req.user)?{$or:[{manager:req.user._id},{member:{$in:await Member.distinct("_id",{manager:req.user._id})}}]}:{member:req.user.memberId};
  res.json({success:true,notifications:await Notification.find(filter).sort({date:-1}).limit(200)});
});
router.patch("/:id/read",requireAuth,async(req,res)=>{
  const filter=isManager(req.user)?{_id:req.params.id,$or:[{manager:req.user._id},{member:{$in:await Member.distinct("_id",{manager:req.user._id})}}]}:{_id:req.params.id,member:req.user.memberId};
  const n=await Notification.findOneAndUpdate(filter,{read:true},{new:true}); if(!n)return res.status(404).json({success:false,message:"Notification not found"});
  res.json({success:true,notification:n});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const memberId=req.body.memberId||null;
  if(memberId&&!await Member.exists({_id:memberId,manager:req.user._id}))return res.status(404).json({success:false,message:"Member not found"});
  const n=await Notification.create({manager:req.user._id,member:memberId,type:req.body.type||"info",message:req.body.message||"",extra:req.body.extra||{}});
  res.status(201).json({success:true,notification:n});
});
module.exports=router;
