const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const { env } = require("./config/env");
const ordersRoutes = require("./routes/orders");
const webhookRoutes = require("./routes/webhook");
const callsRoutes = require("./routes/calls");

const app = express();
app.use(cors({ origin: env.frontendUrl }));
// Raw body for Bolna webhook so HMAC can use exact bytes (stronger than JSON.stringify round-trip).
app.use("/api/webhook/bolna", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "voice-commerce-backend" });
});

app.use("/api/orders", ordersRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/calls", callsRoutes);

// Serve static files from the built React app
const clientBuildPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientBuildPath));

// SPA fallback: send index.html for all GET requests that are not handled by API or static routes
// This enables client-side routing to work on browser refresh and direct URL access.
app.use((req, res) => {
  if (req.method !== "GET") {
    return res.status(404).send("Not Found");
  }
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

module.exports = { app };
