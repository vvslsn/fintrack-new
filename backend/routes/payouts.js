const express=require("express");
const AdminPayout=require("../models/AdminPayout");
const User=require("../models/User");
const {userMemberIds}=require("../middleware/tenant");
const {requireAuth,requireRole}=require("../middleware/auth");
const {managerSchemeIds}=require("../middleware/tenant");
const router=express.Router();
router.get("/",requireAuth,requireRole("admin"),async(req,res)=>{
  const rows=await AdminPayout.find({scheme:{$in:await managerSchemeIds(req.user)}}).populate("scheme","name chitType").populate("member","name email phone").sort({createdAt:-1});
  const memberIds=[...new Set(rows.map(row=>row.member?String(row.member._id):"").filter(Boolean))];
  const users=await User.find({role:"user",$or:[{memberId:{$in:memberIds}},{memberIds:{$in:memberIds}}]}).select("memberId memberIds bankDetails").lean();
  const banks=new Map();
  for(const user of users) for(const id of userMemberIds(user)) if(memberIds.includes(String(id))) banks.set(String(id),user.bankDetails||{});
  res.json({success:true,payouts:rows.map(row=>{
    const payout=row.toObject();
    payout.member= payout.member ? {...payout.member,bankDetails:banks.get(String(payout.member._id))||{}} : null;
    return payout;
  })});
});
router.patch("/:id/pay",requireAuth,requireRole("admin"),async(req,res)=>{
  const p=await AdminPayout.findOneAndUpdate({_id:req.params.id,scheme:{$in:await managerSchemeIds(req.user)}},{status:"paid",paidDate:new Date(),method:req.body.method||"",transactionId:req.body.transactionId||""},{new:true});
  if(!p)return res.status(404).json({success:false,message:"Payout not found"});res.json({success:true,payout:p});
});
module.exports=router;
