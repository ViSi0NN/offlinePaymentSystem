import mongoose, { mongo } from "mongoose";


const payoutSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiverUpi: { type: String, required: true },
    amount: { type: Number, required: true },
    payoutId: { type: String, required: true, unique: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }, // Link to original transaction
    status: { type: String, enum: ["initiated", "processed", "failed", "reversed"], default: "initiated", index: true },
    responseCode: { type: String }, // Store response code from payment provider
    responseMessage: { type: String }, // Store response message
    createdAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date } // When the payout was completed
  });

  const Payout = mongoose.model("Payout", payoutSchema)

  export {Payout}

  