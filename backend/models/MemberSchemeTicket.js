const mongoose = require("mongoose");
const { Schema } = mongoose;

const memberSchemeTicketSchema = new Schema(
    {
        member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
        scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
        ticketNumber: { type: String, required: true, trim: true },

        // Snapshots captured from the scheme at ticket-creation time
        // (not live lookups) — mirrors the frontend's caching behavior.
        chitAmount: { type: Number, default: 0 },
        normalPayment: { type: Number, default: 0 },
        takenPayment: { type: Number, default: 0 },

        chitTaken: { type: Boolean, default: false },
        winningMonth: { type: Number, default: null } // null until this ticket wins
    },
    { timestamps: true }
);

// A ticket number is unique within a scheme (not globally, and a single
// member may legitimately hold several tickets in the same scheme).
memberSchemeTicketSchema.index({ scheme: 1, ticketNumber: 1 }, { unique: true });
memberSchemeTicketSchema.index({ member: 1 });

module.exports = mongoose.model("MemberSchemeTicket", memberSchemeTicketSchema);
