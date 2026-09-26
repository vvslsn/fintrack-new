const express=require("express");
const Payment=require("../models/Payment");
const Member=require("../models/Member");
const Scheme=require("../models/Scheme");
const Winner=require("../models/Winner");
const Request=require("../models/OnlinePaymentRequest");
const {requireAuth,requireRole}=require("../middleware/auth");
const {managerSchemeIds}=require("../middleware/tenant");
const router=express.Router();
router.get("/summary",requireAuth,requireRole("admin"),async(req,res)=>{
  const schemeIds=await managerSchemeIds(req.user);
  const [memberCount,schemeCount,paid,pending,winners,onlinePending]=await Promise.all([
    Member.countDocuments({manager:req.user._id,status:"active"}),Scheme.countDocuments({manager:req.user._id,status:{$ne:"closed"}}),
    Payment.aggregate([{$match:{scheme:{$in:schemeIds},status:"paid"}},{$group:{_id:null,total:{$sum:"$amount"}}}]),
    Payment.countDocuments({scheme:{$in:schemeIds},status:"pending"}),Winner.countDocuments({scheme:{$in:schemeIds},status:"winner"}),Request.countDocuments({scheme:{$in:schemeIds},status:"pending"})
  ]);
  res.json({success:true,summary:{members:memberCount,schemes:schemeCount,totalPaid:paid[0]?.total||0,pendingPayments:pending,winners,onlinePending}});
});
module.exports=router;
