const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new Schema(
    {
        member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
        ticketNumber: { type: String, required: true, trim: true },
        month: { type: Number, required: true, min: 1 },

        // Idempotency key: `${memberId}|${schemeId}|${ticket}|${month}`.
        // Blocks duplicate installment rows — same role as the frontend's
        // fintrackPaymentKey() business key.
        paymentKey: { type: String, required: true, unique: true },

        dueDate: { type: Date, default: null },
        amount: { type: Number, required: true, min: 0 },
        paymentDate: { type: Date, default: null },
        method: { type: String, default: "" },
        transactionId: { type: String, default: "" },

        status: {
            type: String,
            enum: ["pending", "paid"],
            default: "pending"
        },
        receivedByAdmin: { type: Boolean, default: false },
        receivedAt: { type: Date, default: null },

        source: {
            type: String,
            enum: ["manual", "online_payment_request"],
            default: "manual"
        },
        onlineRequest: {
            type: Schema.Types.ObjectId,
            ref: "OnlinePaymentRequest",
            default: null
        }
    },
    { timestamps: true }
);

paymentSchema.index({ scheme: 1, month: 1 });
paymentSchema.index({ member: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
