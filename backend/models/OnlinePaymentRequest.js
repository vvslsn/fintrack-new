const mongoose = require("mongoose");
const { Schema } = mongoose;

const onlinePaymentRequestSchema = new Schema(
    {
        paymentKey: { type: String, required: true }, // memberId|schemeId|ticket|month
        member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
        ticketNumber: { type: String, required: true, trim: true },
        month: { type: Number, required: true, min: 1 },
        amount: { type: Number, required: true, min: 0 },

        paymentMethod: { type: String, default: "" },
        utr: { type: String, required: true, trim: true },
        proofUrl: { type: String, default: "" }, // object storage URL, not a DB blob

        submittedAt: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: String, default: "" },
        rejectionReason: { type: String, default: "" },

        payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null }
    },
    { timestamps: false }
);

onlinePaymentRequestSchema.index({ status: 1 });
onlinePaymentRequestSchema.index({ member: 1 });

// A UTR that is still pending/approved cannot be reused; rejected requests
// are excluded, matching the frontend's own duplicate-UTR check.
onlinePaymentRequestSchema.index(
    { utr: 1 },
    { unique: true, partialFilterExpression: { status: { $ne: "rejected" } } }
);

module.exports = mongoose.model("OnlinePaymentRequest", onlinePaymentRequestSchema);
