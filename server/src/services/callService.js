const axios = require("axios");
const { env } = require("../config/env");
const { appendCallLog, updateOrder } = require("../data/store");
const { prompts, fillTemplate } = require("../utils/prompts");

const deliveryDefault = "Tomorrow 2-5 PM";
const deliveryRescheduled = "Day after tomorrow 10 AM - 1 PM";

const inferResponse = (phase, response) => {
  const value = (response || "").toLowerCase();
  if (phase === 1) {
    if (["yes", "confirm", "haan", "ha", "confirmed"].some((w) => value.includes(w))) {
      return "confirmed";
    }
    if (["no", "cancel", "nahi"].some((w) => value.includes(w))) {
      return "cancelled";
    }
    return "no-response";
  }
  if (["reschedule", "change"].some((w) => value.includes(w))) return "rescheduled";
  if (["keep", "ok", "theek", "thik", "yes"].some((w) => value.includes(w))) return "kept";
  return "no-response";
};

const buildCallPayload = ({ order, phase, promptText, callId }) => ({
  agent_id: phase === 1 ? env.bolnaAgentIdPhase1 : env.bolnaAgentIdPhase2,
  to_number: order.customer.phone,
  webhook_url: `${env.appBaseUrl}${env.bolnaWebhookPath}`,
  metadata: { orderId: order.id, phase, callId },
  prompt: promptText,
  language: order.language || "en",
});

const triggerBolnaCall = async ({ order, phase }) => {
  const language = order.language || "en";
  const promptSet = prompts[language] || prompts.en;
  const promptText = fillTemplate(phase === 1 ? promptSet.phase1 : promptSet.phase2, {
    name: order.customer.name,
    product: order.product.name,
    amount: order.product.amount,
  });

  const callId = `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const payload = buildCallPayload({ order, phase, promptText, callId });

  let providerCallId = callId;
  if (!env.bolnaApiKey) {
    if (!env.simulationMode) {
      throw new Error("BOLNA_API_KEY is missing. Set SIMULATION_MODE=true for demo fallback.");
    }
  } else {
    try {
      console.log("[Bolna] Attempting call ->", {
        agentId: payload.agent_id,
        phoneNumber: payload.to_number,
      });
      const response = await axios.post(`${env.bolnaApiBaseUrl}/v1/calls`, payload, {
        headers: {
          Authorization: `Bearer ${env.bolnaApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });
      console.log("[Bolna] Status:", response.status);
      console.log("[Bolna] Response:", JSON.stringify(response.data));
      providerCallId = response.data?.call_id || response.data?.id || callId;
      console.log("[Bolna] Call triggered successfully");
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status) {
        console.error("[Bolna] Call failed:", { status, data });
        throw new Error(`Bolna call failed with status ${status}`);
      }
      console.error("[Bolna] Network error:", err.message);
      throw err;
    }
  }

  await appendCallLog(order.id, {
    phase,
    callId: providerCallId,
    status: "initiated",
    response: "pending",
    timestamp: new Date().toISOString(),
    transcript: [
      { speaker: "agent", text: promptText },
      { speaker: "system", text: "Call initiated via Bolna API" },
    ],
  });

  return providerCallId;
};

const applyWebhookDecision = async ({
  orderId,
  phase,
  response,
  callId,
  durationSec = 40,
  transcript = [],
}) => {
  const decision = inferResponse(phase, response);
  const patch = {};

  if (phase === 1) {
    if (decision === "confirmed") {
      patch.status = "Confirmed";
      patch.nextActionAt = null;
    }
    if (decision === "cancelled") {
      patch.status = "Cancelled";
      patch.nextActionAt = null;
    }
    if (decision === "no-response") patch.status = "Retry Pending";
  }

  if (phase === 2) {
    if (decision === "rescheduled") {
      patch.status = "Rescheduled";
      patch.deliverySlot = deliveryRescheduled;
      patch.nextActionAt = null;
    } else if (decision === "kept") {
      patch.status = "Slot Confirmed";
      patch.deliverySlot = deliveryDefault;
      patch.nextActionAt = null;
    } else {
      patch.status = "Retry Pending";
    }
  }

  const updated = await updateOrder(orderId, patch);
  if (!updated) return null;

  await appendCallLog(orderId, {
    phase,
    callId,
    status: "completed",
    response: decision,
    durationSec,
    timestamp: new Date().toISOString(),
    newSlot: patch.deliverySlot || null,
    transcript,
  });
  return updated;
};

module.exports = {
  deliveryDefault,
  deliveryRescheduled,
  triggerBolnaCall,
  applyWebhookDecision,
};
