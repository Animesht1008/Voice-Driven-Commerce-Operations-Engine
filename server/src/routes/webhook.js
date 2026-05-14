const express = require("express");
const crypto = require("crypto");
const { env } = require("../config/env");
const { emitCallCompleted } = require("../workflow/workflowEngine");

const router = express.Router();

const verifySignature = (rawBody, signature) => {
  if (!env.bolnaWebhookSecret) return true;
  const expected = crypto
    .createHmac("sha256", env.bolnaWebhookSecret)
    .update(rawBody)
    .digest("hex");
  return signature === expected;
};

router.post("/bolna", async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : JSON.stringify(req.body || {});
  const signature = req.headers["x-bolna-signature"];
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  res.status(200).json({ ok: true });

  try {
    const body = JSON.parse(rawBody);
    const orderId = body.orderId || body.metadata?.orderId;
    const phase = Number(body.phase || body.metadata?.phase || 1);
    const response = body.response || body.intent || body.transcript?.summary || "";
    const callId = body.callId || body.call_id || body.metadata?.callId || `manual_${Date.now()}`;
    const durationSec = Number(body.durationSec || body.duration || 40);
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    console.log("[Webhook] Received ->", { orderId, phase, response });

    if (!orderId) {
      console.warn("[Webhook] Missing orderId - skipping");
      return;
    }

    const updated = await emitCallCompleted({
      orderId,
      phase,
      response,
      callId,
      durationSec,
      transcript,
    });
    if (!updated) console.warn(`[Webhook] Order not found: ${orderId}`);
    else console.log(`[Webhook] Order ${orderId} updated`);
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

module.exports = router;
