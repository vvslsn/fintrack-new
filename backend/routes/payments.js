const express=require("express");
const Payment=require("../models/Payment");
const Request=require("../models/OnlinePaymentRequest");
const Ticket=require("../models/MemberSchemeTicket");
const Scheme=require("../models/Scheme");
const Member=require("../models/Member");
const Notification=require("../models/Notification");
const {requireAuth,requireRole}=require("../middleware/auth");
const {installment,dueDate,paymentKey}=require("../services/chit");
const router=express.Router();

const populate=q=>q.populate("member","name email phone").populate("scheme","name chitType totalAmount baseAmount goldGrams duration startDate");

router.get("/",requireAuth,async(req,res)=>{
  const filter=req.user.role==="user"?{member:req.user.memberId}:{};
  const rows=await populate(Payment.find(filter).sort({month:-1,createdAt:-1}));
  res.json({success:true,payments:rows});
});

router.post("/manual",requireAuth,requireRole("admin"),async(req,res)=>{
  const {memberId,schemeId,ticketNumber,month,method,transactionId,status="paid"}=req.body;
  const [m,s]=await Promise.all([Member.findById(memberId),Scheme.findById(schemeId)]);
  if(!m||!s)return res.status(404).json({success:false,message:"Member or scheme not found"});
  const ticket=await Ticket.findOne({member:m._id,scheme:s._id,ticketNumber:String(ticketNumber)});
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  const winningMonth=Number(ticket.winningMonth||0);
  const amount=installment(s,month,winningMonth), key=paymentKey(m._id,s._id,ticket.ticketNumber,month);
  const d=dueDate(s,month);
  const payment=await Payment.findOneAndUpdate({paymentKey:key},{
    member:m._id,scheme:s._id,ticketNumber:ticket.ticketNumber,month:Number(month),paymentKey:key,dueDate:d,amount,
    paymentDate:status==="paid"?(req.body.paymentDate||new Date()):null,method:method||"",transactionId:transactionId||"",
    status,receivedByAdmin:status==="paid",receivedAt:status==="paid"?new Date():null,source:"manual"
  },{upsert:true,new:true,setDefaultsOnInsert:true});
  res.status(201).json({success:true,payment});
});

router.post("/online",requireAuth,requireRole("user"),async(req,res)=>{
  const {schemeId,ticketNumber,month,utr,paymentMethod,proofUrl}=req.body;
  const ticket=await Ticket.findOne({member:req.user.memberId,scheme:schemeId,ticketNumber:String(ticketNumber)});
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  const scheme=await Scheme.findById(schemeId); if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const amount=installment(scheme,month,ticket.winningMonth), key=paymentKey(ticket.member,scheme._id,ticket.ticketNumber,month);
  if(!utr?.trim())return res.status(400).json({success:false,message:"UTR is required"});
  if(await Payment.exists({paymentKey:key,status:"paid"}))return res.status(409).json({success:false,message:"This installment is already paid"});
  if(await Request.exists({paymentKey:key,status:{$in:["pending","approved"]}}))return res.status(409).json({success:false,message:"Payment request already submitted"});
  if(await Request.exists({utr:utr.trim(),status:{$ne:"rejected"}}))return res.status(409).json({success:false,message:"UTR already used"});
  const r=await Request.create({paymentKey:key,member:ticket.member,scheme:scheme._id,ticketNumber:ticket.ticketNumber,month:Number(month),amount,paymentMethod:paymentMethod||"UPI",utr:utr.trim(),proofUrl:proofUrl||""});
  res.status(201).json({success:true,request:r});
});

router.get("/online/pending",requireAuth,requireRole("admin"),async(req,res)=>{
  const rows=await Request.find().populate("member","name email phone").populate("scheme","name chitType").sort({submittedAt:-1});
  res.json({success:true,requests:rows});
});
router.post("/online/:id/approve",requireAuth,requireRole("admin"),async(req,res)=>{
  const r=await Request.findById(req.params.id); if(!r)return res.status(404).json({success:false,message:"Request not found"});
  if(r.status!=="pending")return res.status(409).json({success:false,message:"Request is already reviewed"});
  const [s,t]=await Promise.all([Scheme.findById(r.scheme),Ticket.findOne({member:r.member,scheme:r.scheme,ticketNumber:r.ticketNumber})]);
  if(!s||!t)return res.status(404).json({success:false,message:"Scheme or ticket not found"});
  const amount=installment(s,r.month,t.winningMonth),key=paymentKey(r.member,r.scheme,r.ticketNumber,r.month);
  if(amount!==r.amount)return res.status(409).json({success:false,message:"Payment amount changed; review the request again"});
  const payment=await Payment.findOneAndUpdate({paymentKey:key},{member:r.member,scheme:r.scheme,ticketNumber:r.ticketNumber,month:r.month,paymentKey:key,dueDate:dueDate(s,r.month),amount,paymentDate:new Date(),method:r.paymentMethod,transactionId:r.utr,status:"paid",receivedByAdmin:true,receivedAt:new Date(),source:"online_payment_request",onlineRequest:r._id},{upsert:true,new:true,setDefaultsOnInsert:true});
  r.status="approved";r.reviewedAt=new Date();r.reviewedBy=req.user.username;r.payment=payment._id;await r.save();
  await Notification.create({member:r.member,type:"payment_approved",message:`Payment for ${s.name}, Month ${r.month} was approved.`,extra:{paymentId:payment._id,requestId:r._id}});
  res.json({success:true,request:r,payment});
});
router.post("/online/:id/reject",requireAuth,requireRole("admin"),async(req,res)=>{
  const r=await Request.findById(req.params.id); if(!r)return res.status(404).json({success:false,message:"Request not found"});
  if(r.status!=="pending")return res.status(409).json({success:false,message:"Request is already reviewed"});
  r.status="rejected";r.reviewedAt=new Date();r.reviewedBy=req.user.username;r.rejectionReason=String(req.body.reason||"Payment request rejected");await r.save();
  await Notification.create({member:r.member,type:"payment_rejected",message:`Payment request for Month ${r.month} was rejected. ${r.rejectionReason}`,extra:{requestId:r._id}});
  res.json({success:true,request:r});
});
module.exports=router;
