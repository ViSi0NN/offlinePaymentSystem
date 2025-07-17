import mongoose from "mongoose";

const smsLogSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, index: true }, // Add index
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Link to user if known
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }, // Link to transaction
    direction: { type: String, enum: ["inbound", "outbound"], required: true }, // Important!
    messageType: { type: String, enum: ["request_payment", "confirmation", "error"], required: true },  
    content: { type: String, required: true },  
    status: { type: String, enum: ["sent", "delivered", "failed"], default: "sent" },
    createdAt: { type: Date, default: Date.now, index: true } // Add index
  });


const SmsLog = mongoose.model("SmsLog", smsLogSchema)

export{SmsLog}