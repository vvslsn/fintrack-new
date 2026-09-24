const express=require("express"); const AuditLog=require("../models/AuditLog"); const {requireAuth,requireRole}=require("../middleware/auth"); const router=express.Router();
router.get("/",requireAuth,requireRole("admin"),async(req,res)=>res.json({success:true,logs:await AuditLog.find().sort({timestamp:-1}).limit(500).populate("actorUser","username fullName")}));
module.exports=router;
