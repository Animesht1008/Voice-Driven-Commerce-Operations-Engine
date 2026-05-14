const mongoose = require("mongoose");
const { env } = require("./env");

const connectDb = async () => {
  if (env.storageMode !== "mongo") return;
  if (!env.mongoUri) throw new Error("MONGODB_URI is required when STORAGE_MODE=mongo");
  await mongoose.connect(env.mongoUri, { dbName: "voice-commerce" });
  console.log("MongoDB connected");
};

module.exports = { connectDb };
