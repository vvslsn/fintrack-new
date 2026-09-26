const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const app = express();
let initialization;

async function initialize() {
  if (mongoose.connection.readyState === 1) return;
  if (!initialization) {
    initialization = (async () => {
      if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 characters");
      }
      await connectDB();
      await require("./services/migrate-tenancy")();
    })().catch(error => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500")
  .split(",").map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Same-origin app requests do not send an Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({
  limit: "5mb",
  verify(req, res, buffer) {
    if (req.originalUrl === "/api/payments/gateway/webhook") req.rawBody = Buffer.from(buffer);
  }
}));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));
app.use("/api", async (req, res, next) => {
  try {
    await initialize();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/schemes", require("./routes/schemes"));
app.use("/api/members", require("./routes/members"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/winners", require("./routes/winners"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/payouts", require("./routes/payouts"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/audit", require("./routes/audit"));

// Keep static serving for the existing local/Docker server. Vercel serves the
// generated public/ files from its CDN before requests reach this function.
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use((req, res) => res.status(404).json({ success: false, message: "API route not found" }));
app.use(errorHandler);

app.initialize = initialize;
module.exports = app;
