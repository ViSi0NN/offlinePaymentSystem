import Razorpay from "razorpay";
import { Transaction } from "../models/transaction.model.js";
import User from "../models/user.model.js";
import crypto from "crypto";
import { updateWalletBalance } from "../utils/walletTransactionService.js";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const verifyRazorPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      userId 
    } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
	console.log("order_id:", razorpay_order_id);
console.log("payment_id:", razorpay_payment_id);
console.log("signature from Razorpay:", razorpay_signature);
console.log("your generated:", generatedSignature);

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Find the transaction in MongoDB
    const transaction = await Transaction.findOneAndUpdate(
      { razorpay_order_id: razorpay_order_id },
      { 
        razorpayPaymentId: razorpay_payment_id,
        status: "success"
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    // Update user's wallet balance
    const walletResult = await updateWalletBalance(
      transaction.senderId,
      transaction.amount,
      "credit",
      transaction._id,
      `Added ₹${transaction.amount} via Razorpay (ID: ${razorpay_payment_id})`
    );

    res.status(200).json({ 
      success: true, 
      message: "Payment verified and wallet updated!",
      currentBalance: walletResult.balance
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error verifying payment", 
      error: error.message 
    });
  }
};

const createRazorOrder = async (req, res) => {
  try {
    const { amount, userId } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid amount. Amount must be greater than 0" 
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Create Razorpay order
    const options = { 
      amount: Math.round(parseInt(amount) * 100), // Convert to paise and ensure it's an integer
      currency: "INR",
      receipt: `txn_${Date.now()}`,
      payment_capture: 1 // Auto-capture
    };
    
    const order = await razorpay.orders.create(options);

    // Store order in MongoDB using Transaction model
    const transaction = new Transaction({
      senderId: userId,
      receiverUpi: user.upiId, // Use user's own UPI ID
      amount,
      type: "add_money",
      status: "pending",
      razorpay_order_id: order.id,
      reference: `Add money to wallet - ${new Date().toISOString()}`
    });
    
    await transaction.save();

    res.json({ 
      success: true, 
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error creating order", 
      error: error.message 
    });
  }
};

// Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({
      success: true,
      balance: user.walletBalance,
      upiId: user.upiId,
      phone: user.phone
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching wallet balance", error: error.message });
  }
};

export { createRazorOrder, verifyRazorPayment, getWalletBalance };
