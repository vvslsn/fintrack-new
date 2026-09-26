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
        mustChangePassword: { type: Boolean, default: false },
        role: {
            type: String,
            enum: ["manager", "admin", "user"],
            default: "manager",
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

// Enforce: role="user" <-> memberId set, role="manager" <-> memberId null.
userSchema.pre("validate", function () {
    if (this.role === "user" && !this.memberId) {
        throw new Error("A user-role account must have a memberId.");
    }
    if (["manager", "admin"].includes(this.role) && this.memberId) {
        throw new Error("A manager account cannot have a memberId.");
    }
});

userSchema.index({ memberId: 1 });

module.exports = mongoose.model("User", userSchema);
