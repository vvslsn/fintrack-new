require("dotenv").config();
const express=require("express");
const cors=require("cors");
const path=require("path");
const connectDB=require("./config/db");
const errorHandler=require("./middleware/errorHandler");
const {notifyOverdueMembers}=require("./services/payment-reminders");

if(!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}

const app=express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500")
  .split(",").map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include local scripts and server-to-server calls.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({
  limit:"5mb",
  verify(req,res,buffer){
    if(req.originalUrl==="/api/payments/gateway/webhook")req.rawBody=Buffer.from(buffer);
  }
}));
app.use(express.urlencoded({extended:true,limit:"5mb"}));

app.get("/api/health",(req,res)=>res.json({success:true,status:"ok",time:new Date().toISOString()}));

app.use("/api/auth",require("./routes/auth"));
app.use("/api/schemes",require("./routes/schemes"));
app.use("/api/members",require("./routes/members"));
app.use("/api/payments",require("./routes/payments"));
app.use("/api/winners",require("./routes/winners"));
app.use("/api/notifications",require("./routes/notifications"));
app.use("/api/settings",require("./routes/settings"));
app.use("/api/payouts",require("./routes/payouts"));
app.use("/api/reports",require("./routes/reports"));
app.use("/api/audit",require("./routes/audit"));

// Serve the browser app from the same origin so local setup needs only one server.
app.use(express.static(path.join(__dirname,"..","frontend")));
app.use((req,res)=>res.status(404).json({success:false,message:"API route not found"}));
app.use(errorHandler);

const PORT=process.env.PORT||5000;
connectDB().then(async()=>{
  await require("./services/migrate-tenancy")();
  const checkPaymentReminders=()=>notifyOverdueMembers().catch(error=>console.error("Payment reminder check failed:",error));
  checkPaymentReminders();
  const reminderTimer=setInterval(checkPaymentReminders,6*60*60*1000);
  reminderTimer.unref();
  app.listen(PORT,()=>console.log(`FinTrack API running on http://localhost:${PORT}`));
}).catch(error=>{
  console.error("FinTrack tenancy migration failed:",error);
  process.exit(1);
});
