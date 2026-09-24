require("dotenv").config();
const express=require("express");
const cors=require("cors");
const connectDB=require("./config/db");
const errorHandler=require("./middleware/errorHandler");

if(!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
if(!process.env.JWT_SECRET) console.warn("WARNING: JWT_SECRET is not configured.");

const app=express();
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:"5mb"}));
app.use(express.urlencoded({extended:true,limit:"5mb"}));

app.get("/",(req,res)=>res.json({success:true,message:"FinTrack Backend API is running"}));
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

app.use((req,res)=>res.status(404).json({success:false,message:"API route not found"}));
app.use(errorHandler);

const PORT=process.env.PORT||5000;
connectDB().then(()=>app.listen(PORT,()=>console.log(`FinTrack API running on http://localhost:${PORT}`)));
