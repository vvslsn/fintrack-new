const express=require("express");
const Scheme=require("../models/Scheme");
const MemberSchemeTicket=require("../models/MemberSchemeTicket");
const Member=require("../models/Member");
const Winner=require("../models/Winner");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();

function out(s){const x=s.toObject();x.id=x._id.toString();x.type=x.chitType;delete x._id;delete x.__v; if(x.goldMonthlyInstallments instanceof Map)x.goldMonthlyInstallments=Object.fromEntries(x.goldMonthlyInstallments); return x;}

router.get("/",requireAuth,async(req,res)=>{
  const schemes=await Scheme.find().sort({createdAt:-1}); res.json({success:true,schemes:schemes.map(out)});
});
router.get("/:id",requireAuth,async(req,res)=>{
  const s=await Scheme.findById(req.params.id); if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  res.json({success:true,scheme:out(s)});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const b=req.body; const data={name:b.name?.trim(),chitType:String(b.chitType||b.type||"cash").toLowerCase(),totalAmount:Number(b.totalAmount||0),baseAmount:Number(b.baseAmount||0),goldGrams:Number(b.goldGrams||0),takenPayment:Number(b.takenPayment||0),duration:Number(b.duration),capacity:Number(b.capacity),startDate:b.startDate,status:b.status||"upcoming"};
  if(data.chitType==="gold" && b.goldMonthlyInstallments) data.goldMonthlyInstallments=b.goldMonthlyInstallments;
  const s=await Scheme.create(data); res.status(201).json({success:true,scheme:out(s)});
});
router.patch("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const allowed=["name","chitType","type","totalAmount","baseAmount","goldGrams","takenPayment","goldMonthlyInstallments","duration","capacity","startDate","status"];
  const b={}; for(const k of allowed) if(req.body[k]!==undefined)b[k]=k==="type"?"chitType":req.body[k];
  if(b.chitType)b.chitType=String(b.chitType).toLowerCase();
  const s=await Scheme.findByIdAndUpdate(req.params.id,b,{new:true,runValidators:true}); if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  res.json({success:true,scheme:out(s)});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const used=await MemberSchemeTicket.exists({scheme:req.params.id})||await Winner.exists({scheme:req.params.id});
  if(used)return res.status(409).json({success:false,message:"Scheme has tickets or winners and cannot be deleted"});
  const s=await Scheme.findByIdAndDelete(req.params.id); if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  res.json({success:true});
});
router.get("/:id/tickets",requireAuth,async(req,res)=>{
  const rows=await MemberSchemeTicket.find({scheme:req.params.id}).populate("member","name email phone status").sort({ticketNumber:1});
  res.json({success:true,tickets:rows});
});
module.exports=router;
