const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { env } = require("./config/env");
const ordersRoutes = require("./routes/orders");
const webhookRoutes = require("./routes/webhook");
const callsRoutes = require("./routes/calls");

const app = express();
app.use(cors({ origin: env.frontendUrl }));
app.use("/api/webhook/bolna", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "voice-commerce-backend" });
});

app.use("/api/orders", ordersRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/calls", callsRoutes);

module.exports = { app };
