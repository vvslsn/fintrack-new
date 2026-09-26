const mongoose = require("mongoose");
const { Schema } = mongoose;

const bankAccountSchema = new Schema(
    {
        manager: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        holderName: { type: String, required: true, trim: true },
        bankName: { type: String, required: true, trim: true },
        accountNumber: {
            type: String,
            required: true,
            match: [/^\d{8,20}$/, "Account number must contain 8 to 20 digits"]
        },
        ifsc: {
            type: String,
            required: true,
            uppercase: true,
            match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"]
        },
        branch: { type: String, default: "" },
        nickname: { type: String, default: "" },
        accountType: { type: String, default: "Savings" }
    },
    { timestamps: true }
);

const BankAccount = mongoose.model("BankAccount", bankAccountSchema);

// Each manager has an independent payment configuration.
const paymentSettingsSchema = new Schema(
    {
        manager: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        activeAccount: {
            type: Schema.Types.ObjectId,
            ref: "BankAccount",
            default: null
        },
        upi: {
            enabled: { type: Boolean, default: true },
            upiId: { type: String, default: "" },
            phonePeNumber: {
                type: String,
                default: "",
                validate: {
                    validator: (v) => !v || /^\d{10}$/.test(v),
                    message: "PhonePe number must contain exactly 10 digits"
                }
            },
            label: { type: String, default: "PhonePe / UPI" },
            qrCode: { type: String, default: "" } // object storage URL
        },
        instructions: { type: String, default: "" }
    },
    { timestamps: true }
);

const PaymentSettings = mongoose.model("PaymentSettings", paymentSettingsSchema);

module.exports = { BankAccount, PaymentSettings };
