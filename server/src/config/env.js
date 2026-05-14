const dotenv = require("dotenv");

// Only load .env file in development
// In production (Render), vars come directly from process.env
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const env = {
  port:               process.env.PORT              || 5000,
  frontendUrl:        process.env.FRONTEND_URL      || "http://localhost:5173",
  appBaseUrl:         process.env.APP_BASE_URL      || "http://localhost:5000",
  storageMode:        process.env.STORAGE_MODE      || "json",
  mongoUri:           process.env.MONGODB_URI       || "",
  workflowTickMs:     Number(process.env.WORKFLOW_TICK_MS)     || 10000,
  retryDelayMinutes:  Number(process.env.RETRY_DELAY_MINUTES)  || 1,
  maxRetries:         Number(process.env.MAX_RETRIES)          || 2,
  simulationMode:     process.env.SIMULATION_MODE   === "true",
  bolnaApiKey:        process.env.BOLNA_API_KEY     || "",
  bolnaApiBaseUrl:    process.env.BOLNA_API_BASE_URL || "https://api.bolna.ai",
  bolnaAgentIdPhase1: process.env.BOLNA_AGENT_ID_PHASE1 || "",
  bolnaAgentIdPhase2: process.env.BOLNA_AGENT_ID_PHASE2 || "",
  bolnaWebhookPath:   process.env.BOLNA_WEBHOOK_PATH    || "/api/webhook/bolna",
  bolnaWebhookSecret: process.env.BOLNA_WEBHOOK_SECRET  || "",
};

// Log on startup so you can verify in Render logs
console.log("[env] Storage mode:", env.storageMode);
console.log("[env] Bolna API key set:", !!env.bolnaApiKey);
console.log("[env] Agent Phase1 set:", !!env.bolnaAgentIdPhase1);
console.log("[env] MongoDB URI set:", !!env.mongoUri);

module.exports = { env };
