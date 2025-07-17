import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  amount: { type: Number, required: true },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
    index: true,
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
  }, // Optional link to transaction
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "reversed"],
    default: "pending",
    index: true,
  },
  balanceBefore: { type: Number, required: true }, // Balance before transaction
  balanceAfter: { type: Number, required: true }, // Balance after transaction
  description: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

const walletTransaction = mongoose.model(
  "walletTransaction",
  walletTransactionSchema
);
export { walletTransaction };
