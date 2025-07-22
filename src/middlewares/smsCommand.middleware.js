import { decryptMessage } from "../utils/decryptMessage.js";
import rateLimit from "express-rate-limit";
import twilio from "twilio";
import { SmsLog } from "../models/smsLog.model.js";
import User from "../models/user.model.js";
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
// Extract phone in consistent format
const extractPhone = (phoneString) => {
  if (!phoneString) return null;
  return phoneString.toString().replace(/^\+/, "").replace(/\D/g, "");
};

// Rate limiting middleware to prevent abuse
export const smsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each phone to 10 requests per windowMs
  keyGenerator: (req) => {
    return extractPhone(req.body?.From) || req.ip;
  },
  handler: async (req, res) => {
    const from = extractPhone(req.body?.From);
    if (from) {
      try {
        await twilioClient.messages.create({
          body: "Too many requests. Please try again later.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: "+" + from,
        });
      } catch (error) {
        console.error("Rate limit notification error:", error);
      }
    }
    return res.status(200).send();
  },
});

export const smsCommandRouterMiddleware = (controllers) => {
  return async (req, res, next) => {
    try {
      console.log("SMS");
      const incomingBody = req.body?.Body || "";
      let from = req.body?.From;
      console.log(from);
      if (from.startsWith("+91")) {
        from = from.slice(3);
      }
      req.body.From = from;
      console.log(incomingBody);
      if (!incomingBody || !from) {
        return res.status(200).send(); // Empty message, just acknowledge
      }

      req.originalMessage = incomingBody.trim();
      const user = await User.findOne(
        { phone: from },
        { sessionKey: 1, sessionKeyExpiry: 1 }
      );

      if (!user) {
        // User not registered
        await twilioClient.messages.create({
          body: "You are not registered. Please register first.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        return res.status(200).send();
      }
      
      if (!user.sessionKeyExpiry || Date.now() > user.sessionKeyExpiry) {
        await twilioClient.messages.create({
          body: "Session expired. Please LOGIN again to start a new session.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        return res.status(200).send();
      }

      // Decryption
      let messageBody;
      try {
        messageBody = await decryptMessage(
          req.originalMessage,
          user.sessionKey
        );
      } catch (decryptionError) {
        console.error("Decryption failed:", decryptionError.message);
        await twilioClient.messages.create({
          body: "Invalid session. Please LOGIN again.",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${from}`,
        });
        return res.status(200).send();
      }

      console.log(messageBody);

      req.data = messageBody;

      const command = messageBody.split(" ")[0].toUpperCase();

      req.sanitizedPhone = extractPhone(from);

      req.smsCommand = command;

      switch (command) {
        case "LOGIN":
          return controllers.loginController(req, res);

        case "VERIFY":
          return controllers.otpController(req, res);

        case "PAY":
          return controllers.paymentController(req, res);

        case "BALANCE":
          return controllers.balanceController(req, res);

        case "TRANSFER":
          return controllers.transferController(req, res);

        case "HELP":
          return controllers.helpController(req, res);

        default:
          await twilioClient.messages.create({
            body: "Unrecognized command. Reply HELP for available commands.",
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${from}`,
          });
          return res.status(200).send();
      }
    } catch (error) {
      console.error("SMS command router error:", error);
      try {
        const from = req.body?.From;
        if (from) {
          await twilioClient.messages.create({
            body: "Sorry, an error occurred processing your request. Please try again later.",
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${from}`,
          });
          await SmsLog.create({
            phoneNumber: extractPhone(from),
            direction: "outbound",
            messageType: "error",
            content: errorMsg,
            status: "sent",
          });
        }
      } catch (notifyError) {
        console.error("Error notification failed:", notifyError);
      }

      return res.status(200).send();
    }
  };
};
