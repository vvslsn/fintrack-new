const mongoose = require("mongoose");
const { Schema } = mongoose;

const auditLogSchema = new Schema(
    {
        actorUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
        action: { type: String, required: true }, // e.g. "scheme.created", "winner.added"
        message: { type: String, required: true },
        details: { type: Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now }
    },
    { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
