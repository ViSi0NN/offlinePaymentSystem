import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import twilio from "twilio";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import crypto from "crypto"; 
import { ApiError } from "../../src/utils/ApiError.js";
import { Transaction } from "../models/transaction.model.js";
import mongoose from "mongoose"

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const generateAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();

    await user.save({ validateBeforeSave: false });
    console.log(accessToken);
    
    return accessToken ;
  } catch (error) {
    throw new ApiError(
      500,
      error.message ||
        "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const {phone, name, upiId, password } = req.body;
  console.log(phone)  
  
  if (!name.trim() || !phone.trim() || !upiId.trim() || !password.trim()) {
    return new ApiError(400,"All data is required");
  }

  const existingUser = await User.findOne({ $or: [{ phone }, { upiId }] });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message:
        existingUser.phone === phone
          ? "Phone number already registered"
          : "UPI ID already registered",
    });
  }

  const user = await User.create({
    name,
    phone,
    password,
    upiId,
  });
  const createdUser = await User.findById(user._id).select("-password");

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering error");

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const checkBalance = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        req.user.walletBalance,
        "Balance fetched successfully"
      )
    );
});



async function appLogin(req, res) {
  try {
    const { phone, password } = req.query;
	  console.log(phone,password);
    if (!phone || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and password are required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000); 

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await twilioClient.messages.create({
      body: `Your login OTP is: ${otp}. Enter this in the app to complete your login.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      userId: user._id,
    });
  } catch (error) {
    console.error("App login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// Verify OTP for app-based login
async function verifyAppOtp(req, res) {
  try {
    const { userId, otp } = req.query;

    if (!userId || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "User ID and OTP are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    console.log(user.otp, parseInt(otp));
    
    if (
      user.otp != parseInt(otp) ||
      !user.otpExpiry ||
      user.otpExpiry < new Date()
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    const sessionKey = crypto.randomBytes(32).toString("base64");
    user.sessionKey = sessionKey;
    user.sessionKeyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const token = await generateAccessToken(user._id);
    await user.save();
	console.log(user);
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      sessionKey,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        upiId: user.upiId,
        walletBalance: user?.walletBalance,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

const isValidObjectId = mongoose.Types.ObjectId.isValid;

async function fetchTransactions(req, res) {
  try {
    const userId = req.query?.userId;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Valid User ID is required" });
    }

    const transactions = await Transaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: "senderId", select: "phone" })
      .populate({ path: "receiverId", select: "phone" });

    const formatted = transactions.map(txn => {
      const isSender = txn.senderId?._id?.toString() === userId;
      return {
        senderPhone: txn.senderId?.phone ?? null,
        receiverPhone: txn.receiverId?.phone ?? txn.receiverUpi ?? null,
        amount: txn.amount,
        status: isSender ? "sent" : "received",
        time: txn.createdAt
      };
    });

    return res.status(200).json({ success: true, transactions: formatted });
  } catch (error) {
    console.error("Transaction fetch error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
async function logoutUser(req, res) {
  try {
    const userId = req.body.userId;
    console.log(userId)
    // Check if userId exists and is a valid ObjectId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $unset: { sessionKey: "", sessionKeyExpiry: "" } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
export { registerUser, appLogin, verifyAppOtp, checkBalance, fetchTransactions, logoutUser };
