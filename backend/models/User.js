const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        fullName: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true },
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
            match: [/^\d{10}$/, "Phone number must be exactly 10 digits"]
        },
        passwordHash: { type: String, required: true },
        role: {
            type: String,
            enum: ["admin", "user"],
            default: "admin",
            required: true
        },
        // Required when role = "user"; must stay null for role = "admin".
        memberId: {
            type: Schema.Types.ObjectId,
            ref: "Member",
            default: null
        },
        profilePhoto: { type: String, default: "" },
        lastLogin: { type: Date, default: null }
    },
    { timestamps: { createdAt: "accountCreated", updatedAt: "updatedAt" } }
);

// Enforce: role="user" <-> memberId set, role="admin" <-> memberId null.
userSchema.pre("validate", function (next) {
    if (this.role === "user" && !this.memberId) {
        return next(new Error("A user-role account must have a memberId."));
    }
    if (this.role === "admin" && this.memberId) {
        return next(new Error("An admin-role account cannot have a memberId."));
    }
});

userSchema.index({ memberId: 1 });

module.exports = mongoose.model("User", userSchema);
