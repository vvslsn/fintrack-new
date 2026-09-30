module.exports = (err,req,res,next)=>{
  console.error(err);
  if(err.code===11000) return res.status(409).json({success:false,message:"A record with these details already exists."});
  const status = err.name === "ValidationError" ? 400 : (err.statusCode || 500);
  const message = status===500 ? "Server error" : (err.name==="CastError" ? `Invalid ${err.path}.` : err.message);
  res.status(status).json({success:false,message, errors: err.errors || undefined});
};
