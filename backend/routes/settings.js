const express=require("express");
const {BankAccount,PaymentSettings}=require("../models/PaymentSettings");
const {requireAuth,requireRole}=require("../middleware/auth");
const Member=require("../models/Member");
const {isManager}=require("../middleware/tenant");
const router=express.Router();
router.get("/payment",requireAuth,async(req,res)=>{
  const managerId=isManager(req.user)?req.user._id:(await Member.findById(req.user.memberId))?.manager;
  if(!managerId)return res.status(404).json({success:false,message:"Manager payment details not found"});
  const s=await PaymentSettings.findOne({manager:managerId}).populate({path:"activeAccount",match:{manager:managerId}}); const accounts=await BankAccount.find({manager:managerId}).sort({createdAt:-1});
  res.json({success:true,settings:s||{upi:{enabled:true,upiId:"",phonePeNumber:"",label:"PhonePe / UPI",qrCode:""},instructions:"",activeAccount:null},accounts});
});
router.post("/accounts",requireAuth,requireRole("admin"),async(req,res)=>{
  const a=await BankAccount.create({...req.body,manager:req.user._id}); res.status(201).json({success:true,account:a});
});
router.patch("/accounts/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const fields={}; for(const key of ["holderName","bankName","accountNumber","ifsc","branch","nickname","accountType"])if(req.body[key]!==undefined)fields[key]=req.body[key];
  const a=await BankAccount.findOneAndUpdate({_id:req.params.id,manager:req.user._id},fields,{new:true,runValidators:true}); if(!a)return res.status(404).json({success:false,message:"Account not found"});res.json({success:true,account:a});
});
router.delete("/accounts/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const a=await BankAccount.findOneAndDelete({_id:req.params.id,manager:req.user._id}); if(!a)return res.status(404).json({success:false,message:"Account not found"}); await PaymentSettings.updateMany({manager:req.user._id,activeAccount:req.params.id},{activeAccount:null});res.json({success:true});
});
router.patch("/payment",requireAuth,requireRole("admin"),async(req,res)=>{
  const {activeAccount,upi,instructions}=req.body;
  if(activeAccount&&!await BankAccount.exists({_id:activeAccount,manager:req.user._id}))return res.status(404).json({success:false,message:"Bank account not found"});
  const s=await PaymentSettings.findOneAndUpdate({manager:req.user._id},{$set:{manager:req.user._id,activeAccount:activeAccount||null,upi:upi||{},instructions:instructions||""}},{upsert:true,new:true,runValidators:true});
  res.json({success:true,settings:await s.populate("activeAccount")});
});
module.exports=router;
