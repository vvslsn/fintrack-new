const mongoose = require("mongoose");
const { Schema } = mongoose;

const winnerSchema = new Schema(
    {
        scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
        month: { type: Number, required: true, min: 1 },

        // Null only when status = "stopped" (admin voided the month with no
        // winner attached yet).
        ticketNumber: { type: String, default: null, trim: true },
        member: { type: Schema.Types.ObjectId, ref: "Member", default: null },

        payout: { type: Number, default: 0 },      // cash winning payout (0 for gold)
        goldGrams: { type: Number, default: 0 },    // gold winning payout (0 for cash)
        winnerPayment: { type: Number, default: 0 }, // new installment from winning month on

        status: {
            type: String,
            enum: ["winner", "stopped"],
            default: "winner"
        }
    },
    { timestamps: { createdAt: false, updatedAt: "updatedAt" } }
);

// A given ticket can win at most once per scheme. Applies only to
// status="winner" rows — "stopped" rows have ticketNumber = null and are
// exempt via the partial filter below.
winnerSchema.index(
    { scheme: 1, ticketNumber: 1 },
    { unique: true, partialFilterExpression: { status: "winner" } }
);
winnerSchema.index({ scheme: 1, status: 1 });
winnerSchema.index({ member: 1 });

module.exports = mongoose.model("Winner", winnerSchema);
