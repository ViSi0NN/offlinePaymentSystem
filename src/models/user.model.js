import jwt from "jsonwebtoken";
import brcypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true, index: true },
  upiId: { type: String, required: true, unique: true },
  walletBalance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }, // For account status
  lastActivity: { type: Date, default: Date.now }, // Track user engagement
  otp: {
    type: Number
  },
  otpExpiry: {
    type: Date
  },
  password: {
    type: String,
    required: true
  },
  createdAt: { type: Date, default: Date.now },
});


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await brcypt.hash(
    this.password,
    10
  );
  next();
});
userSchema.methods.isPasswordCorrect =
  async function (password) {
    return await brcypt.compare(
      password,
      this.password
    );
  };
userSchema.methods.generateAccessToken =
  function () {
    return jwt.sign(
      {
        _id: this._id,
        phone: this.phone,
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn:
          process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
  };

const User = mongoose.model("User", userSchema);

export default User ;
