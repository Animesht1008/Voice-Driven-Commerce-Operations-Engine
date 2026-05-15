const axios = require("axios");
const { env } = require("../config/env");
const { appendCallLog, updateOrder, getOrder } = require("../data/store");
const { prompts, fillTemplate } = require("../utils/prompts");

const deliveryDefault = "Tomorrow 2-5 PM";
const deliveryRescheduled = "Day after tomorrow 10 AM - 1 PM";

const inferResponse = (phase, response) => {
  const value = (response || "").toLowerCase();
  if (phase === 1) {
    if (
      [
        "yes",
        "confirm",
        "haan",
        "confirmed",
        "theek hai",
        "bilkul",
        "rakh lo",
        "ji haan",
        "kar do",
        "karo",
        "ho jaye",
      ].some((w) => value.includes(w))
    ) {
      return "confirmed";
    }
    if (
      [
        "no",
        "cancel",
        "nahi",
        "band karo",
        "nahi chahiye",
        "ji nahi",
        "mat karo",
        "cancel karo",
      ].some((w) => value.includes(w))
    ) {
      return "cancelled";
    }
    return "no-response";
  }
  if (
    ["reschedule", "change", "alag", "different", "dusra", "baad mein", "kal", "later", "nahi"].some((w) =>
      value.includes(w)
    )
  ) {
    return "rescheduled";
  }
  if (
    ["keep", "ok", "theek", "thik", "yes", "same", "rakhna", "bilkul", "haan", "confirmed", "same slot"].some((w) =>
      value.includes(w)
    )
  ) {
    return "kept";
  }
  return "no-response";
};

const normalizeUrl = (url) => String(url || "").replace(/\/+$|\s+/g, "");

const validateBolnaAgentId = (phase) => {
  const agentId = phase === 1 ? env.bolnaAgentIdPhase1 : env.bolnaAgentIdPhase2;
  if (!agentId) {
    throw new Error(
      `BOLNA_AGENT_ID_PHASE${phase} is not configured. Set BOLNA_AGENT_ID_PHASE${phase} in environment.`
    );
  }
  return agentId;
};

const buildCallPayload = ({ order, phase, promptText, callId, metadata }) => {
  const oid = String(metadata?.orderId || order.id || order._id || "");
  const phaseVal = Number(metadata?.phase || phase);
  const callIdVal = String(metadata?.callId || callId);
  const slotForAgent =
    metadata?.deliverySlot ?? order.deliverySlot ?? (phaseVal === 2 ? deliveryDefault : null);

  const amountValue = metadata?.amount ?? order.product.amount;
  const recipientData = {
    orderId: oid,
    order_id: oid,
    phase: phaseVal,
    callId: callIdVal,
    call_id: callIdVal,
    customer_name: metadata?.customerName || order.customer.name,
    customerName: metadata?.customerName || order.customer.name,
    name: metadata?.customerName || order.customer.name,
    product_name: metadata?.productName || order.product.name,
    productName: metadata?.productName || order.product.name,
    product: metadata?.productName || order.product.name,
    amount: amountValue,
    amount_text: String(amountValue),
    amount_rupees: `₹${amountValue}`,
    amount_words: `rupees ${amountValue}`,
    order_summary: `Your order for ${metadata?.productName || order.product.name} worth ₹${amountValue}`,
    ...(phaseVal === 2 && slotForAgent
      ? { delivery_slot: slotForAgent, deliverySlot: slotForAgent }
      : {}),
  };

  const payload = {
    agent_id: validateBolnaAgentId(phaseVal),
    recipient_phone_number: String(order.customer.phone || "").trim(),
    user_data: {
      ...recipientData,
      prompt: promptText,
      customer_name: recipientData.customer_name,
      product_name: recipientData.product_name,
      amount: recipientData.amount,
      rupees: recipientData.amount_rupees,
      order_summary: recipientData.order_summary,
    },
  };

  if (env.bolnaFromPhoneNumber) {
    payload.from_phone_number = env.bolnaFromPhoneNumber;
  }

  if (env.bolnaVoiceId) {
    payload.agent_data = { voice_id: env.bolnaVoiceId };
  }

  return payload;
};

const triggerBolnaCall = async ({ order, phase, metadata }) => {
  if (!order?.customer?.phone) {
    throw new Error("Order is missing customer phone number for Bolna call.");
  }

  const language = order.language || "en";
  const promptSet = prompts[language] || prompts.en;
  const promptText = fillTemplate(phase === 1 ? promptSet.phase1 : promptSet.phase2, {
    name: order.customer.name,
    product: order.product.name,
    amount: order.product.amount,
  });

  const callId = metadata?.callId || `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const payload = buildCallPayload({ order, phase, promptText, callId, metadata });
  const bolnaUrl = `${normalizeUrl(env.bolnaApiBaseUrl)}/call`;

  let providerCallId = callId;
  if (!env.bolnaApiKey) {
    if (!env.simulationMode) {
      throw new Error("BOLNA_API_KEY is missing. Set SIMULATION_MODE=true for local demo without Bolna.");
    }
  } else {
    try {
      console.log("[Bolna] POST", bolnaUrl, {
        agentId: payload.agent_id,
        phase,
        recipient: payload.recipient_phone_number,
        payloadPreview: { agent_id: payload.agent_id, recipient_phone_number: payload.recipient_phone_number },
      });
      const response = await axios.post(bolnaUrl, payload, {
        headers: { Authorization: `Bearer ${env.bolnaApiKey}`, "Content-Type": "application/json" },
        timeout: 15000,
      });
      providerCallId = response.data?.execution_id || response.data?.call_id || response.data?.id || callId;
      console.log("[Bolna] OK", { status: response.status, providerCallId });
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const logPayload = {
        endpoint: bolnaUrl,
        agentId: payload.agent_id,
        phase,
        status,
        data,
        description: status === 404 ? "Bolna endpoint or agent not found" : "Bolna call failed",
      };
      console.error("[Bolna] Call failed", logPayload);
      if (status != null) {
        const message =
          status === 404
            ? `Bolna 404: agent or endpoint not found for phase ${phase}. Check BOLNA_AGENT_ID_PHASE${phase} and BOLNA_API_BASE_URL.`
            : `Bolna call failed with status ${status}`;
        const error = new Error(message);
        error.status = status;
        error.data = data;
        throw error;
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
  const order = await getOrder(orderId);
  if (!order) return null;

  const existingCompleted = order.callLogs?.find(
    (log) =>
      log.phase === phase &&
      log.status === "completed" &&
      (callId ? log.callId === callId : true)
  );
  if (existingCompleted) {
    console.log(`[CallService] Duplicate webhook for phase ${phase} and call ${callId} ignored`);
    return { order, duplicate: true };
  }

  const decision = inferResponse(phase, response);
  const patch = {};

  if (phase === 1) {
    if (decision === "confirmed") {
      patch.status = "Confirmed";
      patch.nextActionAt = null;
      patch.workflowPhase = 2;
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

  return { order: await getOrder(orderId), duplicate: false };
};

module.exports = {
  deliveryDefault,
  deliveryRescheduled,
  triggerBolnaCall,
  applyWebhookDecision,
};
