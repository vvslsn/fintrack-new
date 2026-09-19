const mongoose = require("mongoose");
const { Schema } = mongoose;

const memberSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[\w.+-]+@[\w-]+\.[A-Za-z]{2,}$/, "Invalid email address"]
        },
        phone: {
            type: String,
            required: true,
            match: [/^\d{10}$/, "Phone number must be exactly 10 digits"]
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        joinedDate: { type: Date, required: true },
        profilePhoto: { type: String, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Member", memberSchema);
