const mongoose = require("mongoose");
const { Schema } = mongoose;

// Deliberately a separate collection from Payment, per the original app's
// own design: member installments (Payment) and admin-to-winner payouts
// (this collection) are tracked independently.
const adminPayoutSchema = new Schema(
    {
        winner: {
            type: Schema.Types.ObjectId,
            ref: "Winner",
            required: true,
            unique: true // one payout row per winner record
        },
        scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
        member: { type: Schema.Types.ObjectId, ref: "Member", default: null },
        month: { type: Number, required: true, min: 1 },
        ticketNumber: { type: String, required: true, trim: true },

        type: { type: String, enum: ["cash", "gold"], required: true },
        amount: { type: Number, default: 0 },
        goldGrams: { type: Number, default: 0 },

        status: {
            type: String,
            enum: ["pending", "paid"],
            default: "pending"
        },
        paidDate: { type: Date, default: null },
        method: { type: String, default: "" },
        transactionId: { type: String, default: "" }
    },
    { timestamps: true }
);

adminPayoutSchema.index({ status: 1 });

module.exports = mongoose.model("AdminPayout", adminPayoutSchema);
