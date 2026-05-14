const express = require("express");
const crypto = require("crypto");
const { env } = require("../config/env");
const { emitCallCompleted } = require("../workflow/workflowEngine");

const router = express.Router();

// Reads transcript string and extracts customer's intent
// e.g. "confirm" → "confirmed", "reschedule" → "rescheduled"
const extractIntent = (transcriptText, phase = 1) => {
  if (!transcriptText) return "";

  // Convert to lowercase for case-insensitive matching
  const text = transcriptText.toLowerCase();

  // Look for confirmation keywords
  if (text.includes("confirm") || text.includes("yes") || text.includes("haan") || text.includes("theek") || text.includes("ok")) {
    return phase === 1 ? "confirmed" : "keep";
  }

  // Look for cancellation
  if (text.includes("cancel") || text.includes("nahi") || text.includes("nai") || text.includes("band karo")) {
    return "cancelled";
  }

  // Phase 2 specific
  if (phase === 2) {
    if (text.includes("reschedule") || text.includes("change") || text.includes("baad mein") || text.includes("kal") || text.includes("later")) {
      return "rescheduled";
    }
    if (text.includes("keep") || text.includes("same slot") || text.includes("theek hai")) {
      return "keep";
    }
  }

  return "";
};

router.post("/bolna", async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const body = JSON.parse(req.body.toString("utf8"));

    const orderId =
      body.context_details?.recipient_data?.orderId ||
      body.orderId ||
      body.metadata?.orderId ||
      body.user_data?.orderId;

    const phase = Number(
      body.context_details?.recipient_data?.phase ||
      body.phase ||
      body.metadata?.phase ||
      body.user_data?.phase ||
      1
    );

    const transcriptText = typeof body.transcript === "string"
      ? body.transcript
      : Array.isArray(body.transcript)
        ? body.transcript.map((t) => t.text || "").join(" ")
        : "";

    console.log("[Webhook] orderId found:", orderId);

    const response =
      body.response ||
      body.intent ||
      extractIntent(transcriptText, phase);

    if (!orderId) {
      console.warn("[Webhook] ❌ orderId still undefined - check FULL BODY log above");
      return;
    }

    // Guard: Only process webhooks with transcript (indicating actual call conversation)
    if (!transcriptText || transcriptText.trim().length === 0) {
      console.log("[Webhook] Ignoring webhook without transcript");
      return;
    }

    const callId =
      body.context_details?.recipient_data?.callId ||
      body.call_id ||
      body.execution_id ||
      `manual_${Date.now()}`;

    const durationSec = Number(
      body.telephony_data?.duration ||
      body.durationSec ||
      body.duration ||
      40
    );

    const transcript = transcriptText
      ? transcriptText.split("\n")
          .filter((line) => line.trim())
          .map((line) => ({ text: line.trim() }))
      : [];

    const updated = await emitCallCompleted({ orderId, phase, response, callId, durationSec, transcript });

    if (!updated) console.warn(`[Webhook] ❌ Order not found in DB: ${orderId}`);
    else console.log(`[Webhook] ✅ Order ${orderId} updated — phase ${phase}, response: "${response}"`);
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

module.exports = router;
