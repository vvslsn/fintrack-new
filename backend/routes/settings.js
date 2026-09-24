const express=require("express");
const {BankAccount,PaymentSettings}=require("../models/PaymentSettings");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();
router.get("/payment",requireAuth,async(req,res)=>{
  const s=await PaymentSettings.findOne().populate("activeAccount"); const accounts=await BankAccount.find().sort({createdAt:-1});
  res.json({success:true,settings:s||{upi:{enabled:true,upiId:"",phonePeNumber:"",label:"PhonePe / UPI",qrCode:""},instructions:"",activeAccount:null},accounts});
});
router.post("/accounts",requireAuth,requireRole("admin"),async(req,res)=>{
  const a=await BankAccount.create(req.body); res.status(201).json({success:true,account:a});
});
router.patch("/accounts/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const a=await BankAccount.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true}); if(!a)return res.status(404).json({success:false,message:"Account not found"});res.json({success:true,account:a});
});
router.delete("/accounts/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  await BankAccount.findByIdAndDelete(req.params.id); await PaymentSettings.updateMany({activeAccount:req.params.id},{activeAccount:null});res.json({success:true});
});
router.patch("/payment",requireAuth,requireRole("admin"),async(req,res)=>{
  const {activeAccount,upi,instructions}=req.body;
  const s=await PaymentSettings.findOneAndUpdate({},{$set:{activeAccount:activeAccount||null,upi:upi||{},instructions:instructions||""}},{upsert:true,new:true,runValidators:true});
  res.json({success:true,settings:await s.populate("activeAccount")});
});
module.exports=router;
