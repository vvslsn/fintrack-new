const express=require("express");
const Notification=require("../models/Notification");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();
router.get("/",requireAuth,async(req,res)=>{
  const filter=req.user.role==="user"?{member:req.user.memberId}:{};
  res.json({success:true,notifications:await Notification.find(filter).sort({date:-1}).limit(200)});
});
router.patch("/:id/read",requireAuth,async(req,res)=>{
  const filter=req.user.role==="user"?{_id:req.params.id,member:req.user.memberId}:{_id:req.params.id};
  const n=await Notification.findOneAndUpdate(filter,{read:true},{new:true}); if(!n)return res.status(404).json({success:false,message:"Notification not found"});
  res.json({success:true,notification:n});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const n=await Notification.create({member:req.body.memberId||null,type:req.body.type||"info",message:req.body.message||"",extra:req.body.extra||{}});
  res.status(201).json({success:true,notification:n});
});
module.exports=router;
