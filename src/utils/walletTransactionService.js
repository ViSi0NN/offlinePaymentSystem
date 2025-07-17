import { Transaction } from "../models/transaction.model.js";
import { walletTransaction } from "../models/wallet.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

const updateWalletBalance = async (userId, amount, type, transactionId, description) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Find user and lock the document during transaction
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const balanceBefore = user.walletBalance;
    let balanceAfter;
    
    // Update balance based on transaction type
    if (type === "credit") {
      balanceAfter = balanceBefore + amount;
    } else if (type === "debit") {
      if (balanceBefore < amount) {
        throw new Error("Insufficient wallet balance");
      }
      balanceAfter = balanceBefore - amount;
    } else {
      throw new Error("Invalid transaction type");
    }
    
    // Update user's wallet balance
    user.walletBalance = balanceAfter;
    user.lastActivity = new Date();
    await user.save({ session });
    
    // Create wallet transaction record
    const walletTxn = new walletTransaction({
      userId,
      amount,
      type,
      relatedTransactionId: transactionId,
      status: "completed",
      balanceBefore,
      balanceAfter,
      description: description || `Wallet ${type} of ₹${amount}`,
    });
    
    await walletTxn.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    
    return { success: true, balance: balanceAfter, walletTransaction: walletTxn };
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export { updateWalletBalance };