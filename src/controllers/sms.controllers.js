import User from "../models/user.model.js";
import { encryptMessage } from "../utils/encryptMessage.js";
import { ApiError } from "../utils/ApiError.js";
import twilio from "twilio";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Transaction } from "../models/transaction.model.js";
import { updateWalletBalance } from "../utils/walletTransactionService.js";
import { SmsLog } from "../models/smsLog.model.js";
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendSmsResponse = async (phone, message, statusCode, success) => {
  message = {
    message,
    status: statusCode,
    success,
  };
  let sessionKey = "";
  const user = await User.findOne({phone}, {sessionKey : 1});
  sessionKey = user.sessionKey;
  message = JSON.stringify(message);
  try {
    await twilioClient.messages.create({
      body: await encryptMessage(message, sessionKey),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`,
    });

    return true;
  } catch (error) {
    console.error("SMS sending error:", error);
    if (phone) {
    }
    return false;
  }
};

const extractPhone = (phoneString) => {
  if (!phoneString) return null;
  return phoneString.toString().replace(/^\+/, "").replace(/\D/g, "");
};

// Generate tokens with proper error handling
const generateAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = await user.generateAccessToken();
    await user.save({ validateBeforeSave: false });
    return accessToken;
  } catch (error) {
    throw new ApiError(500, error.message || "Error generating access token");
  }
};

// Verify token and get user
const verifyToken = async (token) => {
  try {
    if (!token) return null;
    const userToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(userToken._id);
    return user;
  } catch (error) {
    console.log(error.message);
    return null;
  }
};

const smsControllers = {
  loginController: async (req, res) => {
    try {
      const messageString = req.data?.trim() || "";
      const parts = messageString.split(" ");
      console.log(parts);

      //Expected format: "LOGIN <phone> <password>"
      const from = extractPhone(req.body?.From || parts[1]);
      console.log(from);
      if (!from || parts.length < 3) {
        await twilioClient.messages.create({
          body: "Invalid format. Please send: LOGIN <password>",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }

      const password = parts[2]?.trim();
      const user = await User.findOne({ phone: from });
      if (!user) {
        await twilioClient.messages.create({
          body: "Phone number not registered. Please register first.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }

      const isPasswordValid = await user.isPasswordCorrect(password);
      if (!isPasswordValid) {
        await twilioClient.messages.create({
          body: "Invalid password. Please try again.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }
      if(!user.sessionKey || !user.sessionKeyExpiry || user.sessionKeyExpiry < Date.now()){
        await twilioClient.messages.create({
          body: "Session expired. Please login again in online mode to generate a new secure session.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        user.sessionKey = undefined;
        user.sessionKeyExpiry = undefined;
        await user.save();
      }
      else{
        const otp = Math.floor(1000 + Math.random() * 9000);
        console.log(otp);
        
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();
        await twilioClient.messages.create({
          body: `Your login OTP is: ${otp}. Reply with "VERIFY ${otp}" to complete login.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
      }
      return res.status(200).send();
    } catch (error) {
      console.error("Login controller error:", error);
      return res.status(200).send();
    }
  },

  otpController: async (req, res) => {
    try {
      const messageBody = req.data?.trim() || "";
      const parts = messageBody.split(" ");

      // Expected format: "VERIFY <otp>"
      const from = extractPhone(req.body?.From);

      if (!from || parts.length < 2) {
        await twilioClient.messages.create({
          body: `Invalid format. Please send: VERIFY <yourOTP>`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }

      const otp = parseInt(parts[1]?.trim(), 10);
      if (isNaN(otp)) {
        await twilioClient.messages.create({
          body: "Invalid OTP format. Please try again.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }

      // Find user and verify OTP
      const user = await User.findOne({ phone: from });
      if (!user) {
        await twilioClient.messages.create({
          body: "Phone number not registered. Please register first.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        
        return res.status(200).send();
      }

      if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
        await twilioClient.messages.create({
          body: "Invalid or expired OTP. Please request a new one.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
       
        return res.status(200).send();
      }

      user.otp = undefined;
      user.otpExpiry = undefined;

      const accessToken = await generateAccessToken(user._id);
      await user.save();
      
      await sendSmsResponse(from, `AUTH ${accessToken} BALANCE ${user.walletBalance.toFixed(2)}`, 200, true);
      return res.status(200).send();
    } catch (error) {
      console.error("OTP controller error:", error);
      return res.status(200).send();
    }
  },

  paymentController: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const messageBody = req.data?.trim() || "";
      const parts = messageBody.split(" ");

      // Format: PAY <amount> <receiver_phone> <description> <token>
      const senderPhone =
        req.sanitizedPhone ||
        req.body?.From.replace(/^\+/, "").replace(/\D/g, "");

      if (!senderPhone || parts.length < 3) {
        await sendSmsResponse(
          senderPhone,
          "Invalid format. Use: PAY <amount> <receiver_phone> <description> <token>",
          400,
          false
        );
        return res.status(200).send();
      }

      const amount = parseFloat(parts[1]?.trim());
      const receiverPhone = parts[2]
        ?.trim()
        .replace(/^\+/, "")
        .replace(/\D/g, "");
      const description = parts[3]?.trim() || "Payment";
      const token = parts.length > 4 ? parts[4]?.trim() : null;

      if (isNaN(amount) || amount <= 0) {
        await sendSmsResponse(
          senderPhone,
          "Invalid amount. Must be a positive number.",
          400,
          false
        );
        return res.status(200).send();
      }

      const sender = token
        ? await verifyToken(token)
        : await User.findOne({ phone: senderPhone }).session(session);

      if (!sender) {
        await sendSmsResponse(
          senderPhone,
          "Authentication failed. Please login first.",
          400,
          false
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).send();
      }

      if (sender.walletBalance < amount) {
        await sendSmsResponse(
          senderPhone,
          `Insufficient balance. Your current balance is ₹${sender.walletBalance.toFixed(2)}`,
          400,
          false
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).send();
      }

      const receiver = await User.findOne({ phone: receiverPhone }).session(
        session
      );
      if (!receiver) {
        await sendSmsResponse(
          senderPhone,
          "Receiver not found. Please check the number.",
          400,
          false
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).send();
      }

      if (sender._id.toString() === receiver._id.toString()) {
        await sendSmsResponse(
          senderPhone,
          "You cannot send a payment to yourself.",
          400,
          false
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).send();
      }

      const paymentId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

      const transaction = new Transaction({
        senderId: sender._id,
        receiverUpi: receiver.upiId || `PHONE:${receiverPhone}`,
        receiverId: receiver._id,
        amount,
        type: "payment",
        status: "pending",
        reference: `Payment to ${receiver.name || receiver.phone}: ${description}`,
      });

      await transaction.save({ session });

      // Update sender wallet (debit)
      const senderWalletResult = await updateWalletBalance(
        sender._id,
        amount,
        "debit",
        transaction._id,
        `Payment to ${receiver.name || receiver.phone}: ${description}`,
        session
      );

      // Update receiver wallet (credit)
      const receiverWalletResult = await updateWalletBalance(
        receiver._id,
        amount,
        "credit",
        transaction._id,
        `Payment from ${sender.name || sender.phone}: ${description}`,
        session
      );

      transaction.status = "success";
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();
      console.log("Transaction successful");
      
      await sendSmsResponse(
        senderPhone,
        `Payment of ₹${amount.toFixed(2)} sent to ${receiver.name || receiver.phone}. Your new balance: ₹${senderWalletResult.balance.toFixed(2)}`,
        200,
        true
      );
      await twilioClient.messages.create({
        body: `You received ₹${amount.toFixed(2)} from ${sender.name || sender.phone}. Your new balance: ₹${receiverWalletResult.balance.toFixed(2)}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${receiverPhone}`,
      });

      return res.status(200).send();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Payment controller error:", error);

      try {
        const from = req.body?.From;
        if (from) {
          await sendSmsResponse(
            from,
            "Error occurred while processing payment. Please try again later.",
            501,
            false);
        }
      } catch (notifyError) {
        console.error("SMS error notification failed:", notifyError);
      }

      return res.status(200).send();
    }
  },

  // // Balance check controller
  // balanceController: async (req, res) => {
  //   try {
  //     const messageBody = req.data?.trim() || "";
  //     const parts = messageBody.split(" ");
  //     const from = extractPhone(req.body?.From);
  //     const token = parts.length > 1 ? parts[1]?.trim() : null;
  //     if (!from) {
  //       return res.status(200).send();
  //     }
  //     // Verify user's token if provided
  //     const user = token ? await verifyToken(token) : await User.findOne({ phone: from });
  //     if (!user) {
  //       await sendSmsResponse(
  //         from,
  //         "Phone number not found or authentication failed. Please register or login first."
  //       );
  //       return res.status(200).send();
  //     }
  //     await sendSmsResponse(
  //       from,
  //       `Your current wallet balance is: ${user.walletBalance.toFixed(2)}. UPI ID: ${user.upiId || "Not set"}`
  //     );
  //     return res.status(200).send();
  //   } catch (error) {
  //     console.error("Balance controller error:", error);
  //     return res.status(200).send();
  //   }
  // },

  // Help controller
  helpController: async (req, res) => {
    try {
      const from = extractPhone(req.body?.From);

      if (!from) {
        return res.status(200).send();
      }

      await sendSmsResponse(
        from,
        `Available commands:
- LOGIN <password>: Start login process
- VERIFY <otp>: Verify login OTP
- PAY <amount> <phone> <description>: Make payment
- BALANCE: Check wallet balance
- TRANSFER <amount> <upiId> <description>: UPI transfer
- HELP: Show this help menu`,
        200,
        true
      );

      return res.status(200).send();
    } catch (error) {
      console.error("Help controller error:", error);
      return res.status(200).send();
    }
  },
};

export { smsControllers };
