const express=require("express");
const AdminPayout=require("../models/AdminPayout");
const {requireAuth,requireRole}=require("../middleware/auth");
const {managerSchemeIds}=require("../middleware/tenant");
const router=express.Router();
router.get("/",requireAuth,requireRole("admin"),async(req,res)=>res.json({success:true,payouts:await AdminPayout.find({scheme:{$in:await managerSchemeIds(req.user)}}).populate("scheme","name chitType").populate("member","name email").sort({createdAt:-1})}));
router.patch("/:id/pay",requireAuth,requireRole("admin"),async(req,res)=>{
  const p=await AdminPayout.findOneAndUpdate({_id:req.params.id,scheme:{$in:await managerSchemeIds(req.user)}},{status:"paid",paidDate:new Date(),method:req.body.method||"",transactionId:req.body.transactionId||""},{new:true});
  if(!p)return res.status(404).json({success:false,message:"Payout not found"});res.json({success:true,payout:p});
});
module.exports=router;
