import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  receiverUpi: { type: String, required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["add_money", "payment"], required: true },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  razorpayPaymentId: { type: String, sparse: true },
  razorpay_order_id: { type: String, sparse: true }, // Added this field
  reference: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

export { Transaction };
