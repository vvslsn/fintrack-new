const mongoose = require("mongoose");
const { Schema } = mongoose;

const schemeSchema = new Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        chitType: {
            type: String,
            enum: ["cash", "gold"],
            required: true
        },
        totalAmount: { type: Number, default: 0, min: 0 },   // cash chit total value
        baseAmount: { type: Number, default: 0, min: 0 },    // fallback/base installment
        goldGrams: { type: Number, default: 0, min: 0 },     // gold chit total grams
        takenPayment: { type: Number, default: 0, min: 0 },  // winner-installment snapshot

        // Embedded, not a separate collection: this is a small map fully
        // owned by the scheme (month -> rupee amount for gold chits), so it
        // reads/writes as one document instead of a join, mirroring the
        // original frontend's scheme.goldMonthlyInstallments object.
        goldMonthlyInstallments: {
            type: Map,
            of: Number,
            default: undefined // only populated for chitType = "gold"
        },

        duration: { type: Number, required: true, min: 1, max: 30 },
        capacity: { type: Number, required: true, min: 1 },
        startDate: { type: Date, required: true },
        status: {
            type: String,
            enum: ["upcoming", "active", "closed"],
            default: "upcoming"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Scheme", schemeSchema);
