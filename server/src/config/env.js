const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  port: process.env.PORT || 5000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5000",
  storageMode: process.env.STORAGE_MODE || "json",
  mongodbUri: process.env.MONGODB_URI || "",
  workflowTickMs: Number(process.env.WORKFLOW_TICK_MS || 10000),
  retryDelayMinutes: Number(process.env.RETRY_DELAY_MINUTES || 5),
  /** Delay after phase-1 confirm before phase-2 call (production). Simulation still uses 30s in scheduler. */
  phase2DelayMinutes: Number(process.env.PHASE2_DELAY_MINUTES || 2),
  maxRetries: Number(process.env.MAX_RETRIES || 2),
  simulationMode: process.env.SIMULATION_MODE === "true",
  bolnaApiKey: process.env.BOLNA_API_KEY || "",
  bolnaApiBaseUrl: process.env.BOLNA_API_BASE_URL || "https://api.bolna.ai",
  bolnaAgentIdPhase1: process.env.BOLNA_AGENT_ID_PHASE1 || "",
  bolnaAgentIdPhase2: process.env.BOLNA_AGENT_ID_PHASE2 || "",
  bolnaFromPhoneNumber: process.env.BOLNA_FROM_PHONE_NUMBER || "",
  bolnaVoiceId: process.env.BOLNA_VOICE_ID || "",
  bolnaWebhookPath: process.env.BOLNA_WEBHOOK_PATH || "/api/webhook/bolna",
  bolnaWebhookSecret: process.env.BOLNA_WEBHOOK_SECRET || "",
  isProduction: process.env.NODE_ENV === "production",
};

module.exports = { env };
