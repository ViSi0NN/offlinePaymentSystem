import mongoose from "mongoose";

// System Configuration Model
const configSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
    updatedAt: { type: Date, default: Date.now }
  });

  const Config = mongoose.model("Config", configSchema);