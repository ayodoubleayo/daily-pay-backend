
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: false },

  totalAmount: { type: Number, default: 0 },
  serviceChargePercent: { type: Number, default: 0 },
  serviceChargeAmount: { type: Number, default: 0 },
  amountToSeller: { type: Number, default: 0 },


  items: { type: Array, default: [] },


  shipping: {
    method: { type: String, enum: ["pickup", "delivery"], default: "pickup" },
    fee: { type: Number, default: 0 },

    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  status: { type: String, default: "pending" },

}, { timestamps: true });

module.exports = mongoose.model("Transaction", TransactionSchema);
