module.exports = (err,req,res,next)=>{
  console.error(err);
  const status = err.name === "ValidationError" ? 400 : (err.statusCode || 500);
  res.status(status).json({success:false,message: status===500 ? "Server error" : err.message, errors: err.errors || undefined});
};
