const mongoose = require("mongoose");

const transcriptSchema = new mongoose.Schema(
  {
    speaker: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const callLogSchema = new mongoose.Schema(
  {
    phase: { type: Number, required: true },
    callId: { type: String, required: true },
    status: { type: String, required: true },
    response: { type: String, default: "pending" },
    durationSec: Number,
    timestamp: { type: Date, default: Date.now },
    newSlot: String,
    transcript: [transcriptSchema],
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    product: {
      name: { type: String, required: true },
      amount: { type: Number, required: true },
    },
    address: { type: String, required: true },
    language: { type: String, enum: ["en", "hi"], default: "en" },
    status: { type: String, default: "Pending" },
    deliverySlot: { type: String, default: null },
    workflowPhase: { type: Number, default: 1 },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 2 },
    nextActionAt: { type: Date, default: null },
    callLogs: [callLogSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
