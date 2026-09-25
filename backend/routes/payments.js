const express=require("express");
const crypto=require("crypto");
const Payment=require("../models/Payment");
const Request=require("../models/OnlinePaymentRequest");
const GatewayOrder=require("../models/GatewayOrder");
const Ticket=require("../models/MemberSchemeTicket");
const Scheme=require("../models/Scheme");
const Member=require("../models/Member");
const Notification=require("../models/Notification");
const {requireAuth,requireRole}=require("../middleware/auth");
const {installment,dueDate,paymentKey}=require("../services/chit");
const router=express.Router();

function gatewayCredentials(){
  const keyId=process.env.RAZORPAY_KEY_ID, keySecret=process.env.RAZORPAY_KEY_SECRET;
  if(!keyId||!keySecret) return null;
  return {keyId,keySecret};
}
function secureHexEqual(left,right){
  if(typeof left!=="string"||typeof right!=="string"||left.length!==right.length)return false;
  const leftBytes=Buffer.from(left,"hex"),rightBytes=Buffer.from(right,"hex");
  return leftBytes.length===rightBytes.length&&leftBytes.length>0&&crypto.timingSafeEqual(leftBytes,rightBytes);
}
async function razorpayRequest(path,credentials,options={}){
  const response=await fetch(`https://api.razorpay.com/v1${path}`,{
    ...options,
    headers:{Authorization:`Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}`,"Content-Type":"application/json",...(options.headers||{})}
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload.error?.description||"Payment provider request failed");
    error.statusCode=502;
    throw error;
  }
  return payload;
}
async function saveCapturedGatewayPayment(order,paymentInfo){
  if(!order||!paymentInfo||paymentInfo.order_id!==order.orderId||paymentInfo.status!=="captured"){
    const error=new Error("Payment is not captured for this order");error.statusCode=409;throw error;
  }
  if(paymentInfo.currency!=="INR"||Number(paymentInfo.amount)!==Math.round(order.amount*100)){
    const error=new Error("Captured payment amount does not match the installment");error.statusCode=409;throw error;
  }
  const alreadyRecorded=await Payment.findOne({paymentKey:order.paymentKey});
  if(alreadyRecorded?.status==="paid"&&alreadyRecorded.transactionId&&alreadyRecorded.transactionId!==paymentInfo.id){
    const error=new Error("This installment has already been paid by another transaction");error.statusCode=409;throw error;
  }
  const paymentDate=paymentInfo.captured_at?new Date(paymentInfo.captured_at*1000):new Date();
  const payment=await Payment.findOneAndUpdate({paymentKey:order.paymentKey},{
    member:order.member,scheme:order.scheme,ticketNumber:order.ticketNumber,month:order.month,paymentKey:order.paymentKey,
    dueDate:order.dueDate||null,amount:order.amount,paymentDate,method:paymentInfo.method||"razorpay",transactionId:paymentInfo.id,
    gatewayOrderId:order.orderId,status:"paid",receivedByAdmin:true,receivedAt:paymentDate,source:"gateway",onlineRequest:null
  },{upsert:true,new:true,setDefaultsOnInsert:true});
  const updatedOrder=await GatewayOrder.findOneAndUpdate({_id:order._id,status:{$ne:"paid"}},
    {status:"paid",paymentId:paymentInfo.id,method:paymentInfo.method||""},{new:true});
  if(updatedOrder){
    await Notification.create({member:order.member,type:"payment_approved",message:`Payment for ${order.schemeName||"your scheme"}, Month ${order.month} was received successfully.`,extra:{paymentId:payment._id,gatewayOrderId:order.orderId}});
  }
  return payment;
}

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
  const paymentMonth=Number(month);
  if(!Number.isInteger(paymentMonth)||paymentMonth<1||paymentMonth>s.duration)return res.status(400).json({success:false,message:"Invalid payment month"});
  if(!["paid","pending"].includes(status))return res.status(400).json({success:false,message:"Invalid payment status"});
  const ticket=await Ticket.findOne({member:m._id,scheme:s._id,ticketNumber:String(ticketNumber)});
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  const winningMonth=Number(ticket.winningMonth||0);
  const amount=installment(s,paymentMonth,winningMonth), key=paymentKey(m._id,s._id,ticket.ticketNumber,paymentMonth);
  const d=dueDate(s,paymentMonth);
  const payment=await Payment.findOneAndUpdate({paymentKey:key},{
    member:m._id,scheme:s._id,ticketNumber:ticket.ticketNumber,month:paymentMonth,paymentKey:key,dueDate:d,amount,
    paymentDate:status==="paid"?(req.body.paymentDate||new Date()):null,method:method||"",transactionId:transactionId||"",
    status,receivedByAdmin:status==="paid",receivedAt:status==="paid"?new Date():null,source:"manual"
  },{upsert:true,new:true,setDefaultsOnInsert:true});
  res.status(201).json({success:true,payment});
});

router.post("/gateway/order",requireAuth,requireRole("user"),async(req,res)=>{
  const credentials=gatewayCredentials();
  if(!credentials)return res.status(503).json({success:false,message:"Payment gateway is not configured. Add Razorpay test keys to the backend environment."});
  const {schemeId,ticketNumber,month}=req.body;
  const paymentMonth=Number(month);
  if(!Number.isInteger(paymentMonth)||paymentMonth<1)return res.status(400).json({success:false,message:"Invalid payment month"});
  const ticket=await Ticket.findOne({member:req.user.memberId,scheme:schemeId,ticketNumber:String(ticketNumber)});
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  const scheme=await Scheme.findById(schemeId);
  if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  if(paymentMonth>scheme.duration)return res.status(400).json({success:false,message:"Invalid payment month"});
  const amount=Number(installment(scheme,paymentMonth,ticket.winningMonth).toFixed(2));
  if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({success:false,message:"Installment amount is invalid"});
  const key=paymentKey(ticket.member,scheme._id,ticket.ticketNumber,paymentMonth);
  if(await Payment.exists({paymentKey:key,status:"paid"}))return res.status(409).json({success:false,message:"This installment is already paid"});
  if(await Request.exists({paymentKey:key,status:{$in:["pending","approved"]}}))return res.status(409).json({success:false,message:"A manual payment request already exists for this installment"});
  if(await GatewayOrder.exists({paymentKey:key,status:"created"}))return res.status(409).json({success:false,message:"A gateway payment is already in progress for this installment"});
  const receipt=`FT${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
  const providerOrder=await razorpayRequest("/orders",credentials,{method:"POST",body:JSON.stringify({
    amount:Math.round(amount*100),currency:"INR",receipt,
    notes:{memberId:String(ticket.member),schemeId:String(scheme._id),ticketNumber:String(ticket.ticketNumber),month:String(paymentMonth)}
  })});
  const gatewayOrder=await GatewayOrder.create({orderId:providerOrder.id,paymentKey:key,member:ticket.member,scheme:scheme._id,schemeName:scheme.name,ticketNumber:ticket.ticketNumber,month:paymentMonth,amount,dueDate:dueDate(scheme,paymentMonth),currency:"INR",status:"created"});
  res.status(201).json({success:true,keyId:credentials.keyId,orderId:gatewayOrder.orderId,amount:providerOrder.amount,currency:providerOrder.currency,customer:{name:req.user.fullName,email:req.user.email,phone:req.user.phone},description:`${scheme.name} — Ticket ${ticket.ticketNumber} — Month ${paymentMonth}`});
});

router.post("/gateway/verify",requireAuth,requireRole("user"),async(req,res)=>{
  const credentials=gatewayCredentials();
  if(!credentials)return res.status(503).json({success:false,message:"Payment gateway is not configured"});
  const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}=req.body;
  if(!orderId||!paymentId||!signature)return res.status(400).json({success:false,message:"Incomplete payment verification details"});
  const order=await GatewayOrder.findOne({orderId,member:req.user.memberId}).populate("scheme","name");
  if(!order)return res.status(404).json({success:false,message:"Payment order not found"});
  const expected=crypto.createHmac("sha256",credentials.keySecret).update(`${order.orderId}|${paymentId}`).digest("hex");
  if(!secureHexEqual(expected,signature))return res.status(400).json({success:false,message:"Payment signature could not be verified"});
  const providerPayment=await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`,credentials);
  if(providerPayment.order_id!==order.orderId)return res.status(409).json({success:false,message:"Payment does not match this order"});
  if(providerPayment.status!=="captured")return res.status(409).json({success:false,message:"Payment is not captured yet. Check your payment history shortly."});
  const payment=await saveCapturedGatewayPayment(order,providerPayment);
  res.json({success:true,message:"Payment captured and recorded",payment});
});

router.post("/gateway/webhook",async(req,res)=>{
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature=req.headers["x-razorpay-signature"];
  if(!secret||!req.rawBody||!signature)return res.status(400).json({success:false,message:"Webhook verification is not configured"});
  const expected=crypto.createHmac("sha256",secret).update(req.rawBody).digest("hex");
  if(!secureHexEqual(expected,signature))return res.status(400).json({success:false,message:"Invalid webhook signature"});
  const event=req.body?.event;
  if(event!=="payment.captured")return res.json({success:true,received:true});
  const paymentInfo=req.body?.payload?.payment?.entity;
  const order=await GatewayOrder.findOne({orderId:paymentInfo?.order_id}).populate("scheme","name");
  if(!order)return res.status(404).json({success:false,message:"Payment order not found"});
  await saveCapturedGatewayPayment(order,paymentInfo);
  res.json({success:true,received:true});
});

router.post("/online",requireAuth,requireRole("user"),async(req,res)=>{
  const {schemeId,ticketNumber,month,utr,paymentMethod,proofUrl}=req.body;
  const ticket=await Ticket.findOne({member:req.user.memberId,scheme:schemeId,ticketNumber:String(ticketNumber)});
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  const scheme=await Scheme.findById(schemeId); if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const paymentMonth=Number(month);
  if(!Number.isInteger(paymentMonth)||paymentMonth<1||paymentMonth>scheme.duration)return res.status(400).json({success:false,message:"Invalid payment month"});
  const amount=installment(scheme,paymentMonth,ticket.winningMonth), key=paymentKey(ticket.member,scheme._id,ticket.ticketNumber,paymentMonth);
  if(!utr?.trim())return res.status(400).json({success:false,message:"UTR is required"});
  if(await Payment.exists({paymentKey:key,status:"paid"}))return res.status(409).json({success:false,message:"This installment is already paid"});
  if(await Request.exists({paymentKey:key,status:{$in:["pending","approved"]}}))return res.status(409).json({success:false,message:"Payment request already submitted"});
  if(await GatewayOrder.exists({paymentKey:key,status:"created"}))return res.status(409).json({success:false,message:"A gateway payment is already in progress for this installment"});
  if(await Request.exists({utr:utr.trim(),status:{$ne:"rejected"}}))return res.status(409).json({success:false,message:"UTR already used"});
  const r=await Request.create({paymentKey:key,member:ticket.member,scheme:scheme._id,ticketNumber:ticket.ticketNumber,month:paymentMonth,amount,paymentMethod:paymentMethod||"UPI",utr:utr.trim(),proofUrl:proofUrl||""});
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
