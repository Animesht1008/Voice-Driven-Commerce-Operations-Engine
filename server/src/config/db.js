const mongoose = require("mongoose");
const { env } = require("./env");

const connectDb = async () => {
  if (env.storageMode !== "mongo") return;
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required when STORAGE_MODE=mongo");
  }
  try {
    await mongoose.connect(env.mongodbUri, { dbName: "voice-commerce" });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }
};

module.exports = { connectDb };
