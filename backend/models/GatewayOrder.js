const mongoose = require("mongoose");
const { Schema } = mongoose;

const gatewayOrderSchema = new Schema({
    orderId: { type: String, required: true, unique: true },
    paymentKey: { type: String, required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    scheme: { type: Schema.Types.ObjectId, ref: "Scheme", required: true },
    ticketNumber: { type: String, required: true, trim: true },
    month: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, default: null },
    schemeName: { type: String, default: "" },
    currency: { type: String, default: "INR", enum: ["INR"] },
    status: { type: String, default: "created", enum: ["created", "paid"] },
    paymentId: { type: String, default: "" },
    method: { type: String, default: "" }
}, { timestamps: true });

gatewayOrderSchema.index({ member: 1, createdAt: -1 });

module.exports = mongoose.model("GatewayOrder", gatewayOrderSchema);
