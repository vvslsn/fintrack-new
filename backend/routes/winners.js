const express=require("express");
const Winner=require("../models/Winner");
const Ticket=require("../models/MemberSchemeTicket");
const Scheme=require("../models/Scheme");
const Member=require("../models/Member");
const AdminPayout=require("../models/AdminPayout");
const Notification=require("../models/Notification");
const {requireAuth,requireRole}=require("../middleware/auth");
const {payout,installment}=require("../services/chit");
const router=express.Router();

router.get("/",requireAuth,async(req,res)=>{
  const filter=req.user.role==="user"?{member:req.user.memberId}:{};
  const rows=await Winner.find(filter).populate("scheme","name chitType totalAmount goldGrams").populate("member","name email phone").sort({updatedAt:-1,month:-1});
  res.json({success:true,winners:rows});
});
router.post("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const {schemeId,month,ticketNumber}=req.body;
  const scheme=await Scheme.findById(schemeId); if(!scheme)return res.status(404).json({success:false,message:"Scheme not found"});
  const m=Number(month); if(!Number.isInteger(m)||m<1||m>scheme.duration)return res.status(400).json({success:false,message:"Invalid winner month"});
  const count=await Winner.countDocuments({scheme:scheme._id,month:m,status:"winner"}); if(count>=2)return res.status(409).json({success:false,message:"Maximum 2 winners are allowed for this month"});
  const ticket=await Ticket.findOne({scheme:scheme._id,ticketNumber:String(ticketNumber)}).populate("member");
  if(!ticket)return res.status(404).json({success:false,message:"Ticket not found"});
  if(ticket.winningMonth)return res.status(409).json({success:false,message:"This ticket has already won in this chit"});
  const existing=await Winner.exists({scheme:scheme._id,ticketNumber:ticket.ticketNumber,status:"winner"});if(existing)return res.status(409).json({success:false,message:"This ticket has already won in this chit"});
  const pay=payout(scheme,m), winPayment=installment(scheme,m,m);
  const winner=await Winner.create({scheme:scheme._id,month:m,ticketNumber:ticket.ticketNumber,member:ticket.member._id,payout:pay.cash,goldGrams:pay.goldGrams,winnerPayment:winPayment,status:"winner"});
  ticket.winningMonth=m;ticket.chitTaken=true;ticket.takenPayment=winPayment;await ticket.save();
  const type=scheme.chitType==="gold"?"gold":"cash";
  await AdminPayout.create({winner:winner._id,scheme:scheme._id,member:ticket.member._id,month:m,ticketNumber:ticket.ticketNumber,type,amount:pay.cash,goldGrams:pay.goldGrams});
  await Notification.create({member:ticket.member._id,type:"winner",message:`You are a winner for ${scheme.name}, Month ${m}.`,extra:{winnerId:winner._id}});
  res.status(201).json({success:true,winner});
});
router.delete("/:id",requireAuth,requireRole("admin"),async(req,res)=>{
  const w=await Winner.findById(req.params.id); if(!w)return res.status(404).json({success:false,message:"Winner not found"});
  await Ticket.updateOne({scheme:w.scheme,ticketNumber:w.ticketNumber},{winningMonth:null,chitTaken:false,takenPayment:0});
  await AdminPayout.deleteOne({winner:w._id}); await Winner.deleteOne({_id:w._id});
  res.json({success:true});
});
router.post("/stopped",requireAuth,requireRole("admin"),async(req,res)=>{
  const {schemeId,month}=req.body; const s=await Scheme.findById(schemeId); if(!s)return res.status(404).json({success:false,message:"Scheme not found"});
  const m=Number(month); if(!Number.isInteger(m)||m<1||m>s.duration)return res.status(400).json({success:false,message:"Invalid month"});
  const existing=await Winner.findOne({scheme:s._id,month:m,status:"winner"}); if(existing)return res.status(409).json({success:false,message:"Month already has a winner"});
  const row=await Winner.findOneAndUpdate({scheme:s._id,month:m,status:"stopped"},{scheme:s._id,month:m,ticketNumber:null,member:null,status:"stopped"},{upsert:true,new:true});
  res.status(201).json({success:true,winner:row});
});
module.exports=router;
