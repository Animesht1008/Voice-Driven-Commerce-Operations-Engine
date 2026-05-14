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

const buildCallPayload = ({ order, phase, promptText, callId, metadata }) => {
  const orderIdValue = metadata?.orderId || order.id || order._id?.toString();
  const phaseValue = metadata?.phase || phase;
  const callIdValue = metadata?.callId || callId;
  const recipientData = {
    orderId: orderIdValue,
    phase: phaseValue,
    callId: callIdValue,
    customer_name: metadata?.customerName || order.customer.name,
    product_name: metadata?.productName || order.product.name,
    amount: metadata?.amount || order.product.amount,
  };

  return {
    agent_id: phaseValue === 1 ? env.bolnaAgentIdPhase1 : env.bolnaAgentIdPhase2,
    to_number: order.customer.phone,
    webhook_url: `${env.appBaseUrl}${env.bolnaWebhookPath}`,
    metadata: { orderId: orderIdValue, phase: phaseValue, callId: callIdValue },
    user_data: { ...recipientData },
    extra_data: { ...recipientData },
    recipient_data: { ...recipientData },
    prompt: promptText,
    language: order.language || "en",
  };
};

const triggerBolnaCall = async ({ order, phase, metadata }) => {
  const language = order.language || "en";
  const promptSet = prompts[language] || prompts.en;
  const rawPrompt = phase === 1 ? promptSet.phase1 : promptSet.phase2;
  
  // Fill template variables with actual customer data
  const templateData = {
    name: order.customer.name,
    product: order.product.name,
    amount: order.product.amount
  };
  const promptText = fillTemplate(rawPrompt, templateData);

  const callId = metadata?.callId || `call_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const payload = buildCallPayload({ order, phase, promptText, callId, metadata });

  let providerCallId = callId;
  if (!env.bolnaApiKey) {
    if (!env.simulationMode) {
      throw new Error("BOLNA_API_KEY is missing. Set SIMULATION_MODE=true for demo fallback.");
    }
  } else {
    try {
      console.log("[Bolna] Attempting call →", { agentId: payload.agent_id, phoneNumber: payload.to_number });

      const response = await fetch(`${env.bolnaApiBaseUrl}/call`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.bolnaApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agent_id: payload.agent_id,
          recipient_phone_number: payload.to_number,
          webhook_url: payload.webhook_url,
          prompt: payload.prompt,
          language: payload.language,
          metadata: payload.metadata,
          user_data: payload.user_data,
          extra_data: payload.extra_data,
          recipient_data: payload.recipient_data,
        })
      });

      const data = await response.json();
      console.log("[Bolna] Status:", response.status);
      console.log("[Bolna] Response:", JSON.stringify(data));

      if (!response.ok) {
        console.error("[Bolna] ❌ Call failed:", data);
        throw new Error(`Bolna call failed with status ${response.status}`);
      }

      console.log("[Bolna] ✅ Call triggered successfully");
      providerCallId = data?.call_id || data?.id || callId;

    } catch (err) {
      console.error("[Bolna] ❌ Network error:", err.message);
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

  // Prevent duplicate processing for the same phase
  const existingCompleted = order.callLogs?.find(
    (log) => log.phase === phase && log.status === "completed"
  );
  if (existingCompleted) {
    console.log(`[CallService] Duplicate webhook for phase ${phase} ignored`);
    return order;
  }

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
