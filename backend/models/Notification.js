const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema(
    {
        member: { type: Schema.Types.ObjectId, ref: "Member", default: null },
        type: { type: String, required: true },
        message: { type: String, required: true },
        date: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
        // Free-form bag of related ids (requestId, paymentId, etc.) — shape
        // varies by notification type, so it's kept schemaless like the
        // frontend's ...extra spread rather than forcing sparse columns.
        extra: { type: Schema.Types.Mixed, default: {} }
    },
    { timestamps: false }
);

notificationSchema.index({ member: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
