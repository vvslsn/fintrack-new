const express=require("express");
const Payment=require("../models/Payment");
const Member=require("../models/Member");
const Scheme=require("../models/Scheme");
const Winner=require("../models/Winner");
const Request=require("../models/OnlinePaymentRequest");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();
router.get("/summary",requireAuth,requireRole("admin"),async(req,res)=>{
  const [members,schemes,paid,pending,winners,onlinePending]=await Promise.all([
    Member.countDocuments({status:"active"}),Scheme.countDocuments({status:{$ne:"closed"}}),
    Payment.aggregate([{$match:{status:"paid"}},{$group:{_id:null,total:{$sum:"$amount"}}}]),
    Payment.countDocuments({status:"pending"}),Winner.countDocuments({status:"winner"}),Request.countDocuments({status:"pending"})
  ]);
  res.json({success:true,summary:{members,schemes,totalPaid:paid[0]?.total||0,pendingPayments:pending,winners,onlinePending}});
});
module.exports=router;
