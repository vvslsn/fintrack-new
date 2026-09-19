const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const SchemaHandler = require("./routes/SchemaHandler.js");

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "FinTrack Backend API is Running"
    });
});

app.use("/api/auth", authRoutes);

//app.use('/create-scheme/create', SchemaHandler);



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});