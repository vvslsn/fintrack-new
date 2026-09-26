const jwt = require("jsonwebtoken");
const User = require("../models/User");

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
};

async function requireAuth(req,res,next){
  try{
    const h = req.headers.authorization || "";
    if(!h.startsWith("Bearer ")) return res.status(401).json({success:false,message:"Authentication required"});
    const payload = jwt.verify(h.slice(7), secret());
    const user = await User.findById(payload.id).select("-passwordHash");
    if(!user) return res.status(401).json({success:false,message:"User not found"});
    req.user = user;
    next();
  }catch(e){ return res.status(401).json({success:false,message:"Invalid or expired token"}); }
}
function requireRole(...roles){
  return (req,res,next)=>{
    // Keep legacy route declarations working while admin accounts are renamed
    // to manager in the persisted user records.
    const allowed = roles.includes("admin") ? [...roles, "manager"] : roles;
    if(!req.user || !allowed.includes(req.user.role)) return res.status(403).json({success:false,message:"Access denied"});
    next();
  };
}
function signUser(user){ return jwt.sign({id:user._id.toString(),role:user.role},secret(),{expiresIn:"7d"}); }
module.exports={requireAuth,requireRole,signUser};
