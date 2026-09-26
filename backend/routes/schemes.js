const express=require("express");
const Scheme=require("../models/Scheme");
const MemberSchemeTicket=require("../models/MemberSchemeTicket");
const Member=require("../models/Member");
const Payment=require("../models/Payment");
const OnlinePaymentRequest=require("../models/OnlinePaymentRequest");
const GatewayOrder=require("../models/GatewayOrder");
const Winner=require("../models/Winner");
const AdminPayout=require("../models/AdminPayout");
const {requireAuth,requireRole}=require("../middleware/auth");
const {isManager}=require("../middleware/tenant");
const router=express.Router();

function out(s){const x=s.toObject();x.id=x._id.toString();x.type=x.chitType;delete x._id;delete x.__v; if(x.goldMonthlyInstallments instanceof Map)x.goldMonthlyInstallments=Object.fromEntries(x.goldMonthlyInstallments); return x;}
function cleanGoldInstallments(value,duration){
  if(!Number.isInteger(Number(duration))||Number(duration)<1||Number(duration)>30)return null;
  if(!value||typeof value!=="object")return null;
  const result={};
  for(const [key,raw] of Object.entries(value)){
    const month=Number(key),amount=Number(raw);
    if(!Number.isInteger(month)||month<1||month>Number(duration)||!Number.isFinite(amount)||amount<=0)return null;
    result[String(month)]=amount;
  }
  return Number(result["1"])>0?result:null;
}

router.get("/",requireAuth,async(req,res)=>{
  const filter=isManager(req.user)?{manager:req.user._id}:{_id:{$in:await MemberSchemeTicket.distinct("scheme",{member:req.user.memberId})}};
  const schemes=await Scheme.find(filter).sort({createdAt:-1}); res.json({success:true,schemes:schemes.map(out)});
});
router.get("/:id",requireAuth,async(req,res)=>{
  const filter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.params.id};
  if(!isManager(req.user)&&!await MemberSchemeTicket.exists({member:req.user.memberId,scheme:req.params.id}))return res.status(404).json({success:false,message:"Scheme not found"});
  const s=await Scheme.findOne(filter); if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  res.json({success:true,scheme:out(s)});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const b=req.body; const duration=Number(b.duration); const chitType=String(b.chitType||b.type||"cash").toLowerCase();
  if(chitType==="gold"){
    const installments=cleanGoldInstallments(b.goldMonthlyInstallments,duration);
    if(!installments)return res.status(400).json({success:false,message:"Enter a valid Month 1 installment amount."});
    b.goldMonthlyInstallments=installments;
    b.baseAmount=installments["1"];
  }
  const data={manager:req.user._id,name:b.name?.trim(),chitType,totalAmount:Number(b.totalAmount||0),baseAmount:Number(b.baseAmount||0),goldGrams:Number(b.goldGrams||0),takenPayment:Number(b.takenPayment||0),goldMonthlyInstallments:chitType==="gold"?b.goldMonthlyInstallments:undefined,duration,capacity:Number(b.capacity),startDate:b.startDate,status:b.status||"upcoming"};
  const s=await Scheme.create(data); res.status(201).json({success:true,scheme:out(s)});
});
router.patch("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const existing=await Scheme.findOne({_id:req.params.id,manager:req.user._id}); if(!existing)return res.status(404).json({success:false,message:"Scheme not found"});
  const allowed=["name","chitType","type","totalAmount","baseAmount","goldGrams","takenPayment","goldMonthlyInstallments","duration","capacity","startDate","status"];
  const b={}; for(const k of allowed) if(req.body[k]!==undefined)b[k]=k==="type"?"chitType":req.body[k];
  if(b.chitType)b.chitType=String(b.chitType).toLowerCase();
  const chitType=b.chitType||existing.chitType;
  const duration=Number(b.duration??existing.duration);
  const scheduleChanged=b.goldMonthlyInstallments!==undefined||b.duration!==undefined||b.chitType!==undefined;
  if(chitType==="gold"&&scheduleChanged){
    const current=existing.goldMonthlyInstallments instanceof Map?Object.fromEntries(existing.goldMonthlyInstallments):existing.goldMonthlyInstallments;
    const installments=cleanGoldInstallments(b.goldMonthlyInstallments??current,duration);
    if(!installments)return res.status(400).json({success:false,message:"Enter a valid Month 1 installment amount and positive values for any months already configured."});
    b.goldMonthlyInstallments=installments;
    b.baseAmount=installments["1"];
  }
  let s;
  if(chitType!=="gold"&&existing.chitType==="gold")s=await Scheme.findOneAndUpdate({_id:req.params.id,manager:req.user._id},{$set:b,$unset:{goldMonthlyInstallments:1}},{new:true,runValidators:true});
  else s=await Scheme.findOneAndUpdate({_id:req.params.id,manager:req.user._id},b,{new:true,runValidators:true});
  if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  res.json({success:true,scheme:out(s)});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const scheme=await Scheme.findOne({_id:req.params.id,manager:req.user._id}); if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const used=await MemberSchemeTicket.exists({scheme:scheme._id})||await Winner.exists({scheme:scheme._id});
  if(used)return res.status(409).json({success:false,message:"Scheme has tickets or winners and cannot be deleted"});
  await Scheme.deleteOne({_id:scheme._id});
  res.json({success:true});
});
router.get("/:id/tickets",requireAuth,async(req,res)=>{
  const schemeFilter=isManager(req.user)?{_id:req.params.id,manager:req.user._id}:{_id:req.params.id};
  if(!isManager(req.user)&&!await MemberSchemeTicket.exists({member:req.user.memberId,scheme:req.params.id}))return res.status(404).json({success:false,message:"Scheme not found"});
  const scheme=await Scheme.findOne(schemeFilter); if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const filter={scheme:scheme._id};
  if(!isManager(req.user))filter.member=req.user.memberId;
  const rows=await MemberSchemeTicket.find(filter).populate("member","name email phone status joinedDate").sort({ticketNumber:1});
  res.json({success:true,tickets:rows});
});
router.delete("/:id/tickets/:ticketId",requireAuth,requireRole("admin"),async(req,res)=>{
  const scheme=await Scheme.findOne({_id:req.params.id,manager:req.user._id});
  if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const ticket=await MemberSchemeTicket.findOne({_id:req.params.ticketId,scheme:scheme._id});
  if(!ticket)return res.status(404).json({success:false,message:"Member ticket not found"});

  const key={scheme:scheme._id,ticketNumber:ticket.ticketNumber};
  const hasHistory=await Promise.all([
    Payment.exists({...key,member:ticket.member}),
    OnlinePaymentRequest.exists({...key,member:ticket.member}),
    GatewayOrder.exists({...key,member:ticket.member}),
    Winner.exists(key),
    AdminPayout.exists({...key,member:ticket.member})
  ]);
  if(hasHistory.some(Boolean))return res.status(409).json({success:false,message:"This ticket has payment or winner history and cannot be removed."});

  await MemberSchemeTicket.deleteOne({_id:ticket._id});
  res.json({success:true});
});
module.exports=router;
