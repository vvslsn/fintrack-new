const mongoose = require("mongoose");
const { Schema } = mongoose;

const memberSchema = new Schema(
    {
        manager: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
            unique: true,
            trim: true,
            match: [/^\d{10}$/, "Phone number must be exactly 10 digits"]
        },
        status: {
            type: String,
            enum: ["active", "inactive", "completed"],
            default: "active"
        },
        joinedDate: { type: Date, required: true },
        profilePhoto: { type: String, default: "" }
    },
    { timestamps: true }
);

// The tenancy migration checks existing global contact duplicates before
// creating the unique indexes, so Mongoose must not build them prematurely.
memberSchema.set("autoIndex", false);

module.exports = mongoose.model("Member", memberSchema);
