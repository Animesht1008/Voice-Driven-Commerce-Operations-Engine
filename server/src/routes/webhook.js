const express = require("express");
const crypto = require("crypto");
const { env } = require("../config/env");
const { emitCallCompleted } = require("../workflow/workflowEngine");

const router = express.Router();

// Webhook signature verification for security
const verifyWebhookSignature = () => {
  // Bolna does not send an HMAC signature in this integration,
  // so webhook validation must remain disabled until the provider
  // supports a verifiable signing scheme.
  return true;
};

const extractWebhookMetadata = (body) => {
  const recipientData =
    body.context_details?.recipient_data ||
    body.context?.recipient_data ||
    body.recipient_data ||
    body.agent_context_details?.recipient_data ||
    body.data?.recipient_data ||
    body.recipientData ||
    body.data?.recipientData ||
    {};

  const parsedRecipientData =
    typeof recipientData === "string"
      ? (() => {
          try {
            return JSON.parse(recipientData);
          } catch {
            return { raw: recipientData };
          }
        })()
      : recipientData;

  console.log(
    "[Webhook] Raw recipientData:",
    JSON.stringify(parsedRecipientData, null, 2)
  );

  return {
    orderId:
      parsedRecipientData.orderId ||
      parsedRecipientData.order_id ||
      parsedRecipientData.order_id ||
      body.orderId ||
      body.order_id,

    phase:
      Number(parsedRecipientData.phase || parsedRecipientData.phase_number || 1),

    callId:
      parsedRecipientData.callId ||
      parsedRecipientData.call_id ||
      body.call_id ||
      body.execution_id,

    recipientData: parsedRecipientData,
  };
};

const parseStructuredResponse = (value) => {
  if (value == null) return {
    reply: "",
    intent: "",
    status: "",
    decision: "",
    raw: ""
  };

  if (typeof value === "object") {
    const reply = String(value.reply || value.text || value.message || value.output || value.outputText || value.answer || value.response || "");
    const intent = String(value.intent || value.action || value.final_decision || value.decision || value.status || value.result || value.outcome || "");
    const status = String(value.status || value.intent || value.action || value.final_decision || value.decision || value.result || value.outcome || "");
    const decision = intent || status || reply;
    return {
      reply,
      intent,
      status,
      decision,
      raw: JSON.stringify(value)
    };
  }

  if (typeof value !== "string") return {
    reply: String(value),
    intent: "",
    status: "",
    decision: String(value),
    raw: String(value)
  };

  const trimmed = value.trim();
  if (!trimmed) return {
    reply: "",
    intent: "",
    status: "",
    decision: "",
    raw: ""
  };

  if (/^[\[{]/.test(trimmed)) {
    try {
      return parseStructuredResponse(JSON.parse(trimmed));
    } catch {
      return {
        reply: trimmed,
        intent: "",
        status: "",
        decision: trimmed,
        raw: trimmed
      };
    }
  }

  return {
    reply: trimmed,
    intent: "",
    status: "",
    decision: trimmed,
    raw: trimmed
  };
};

const getWebhookResponse = (body) => {
  return parseStructuredResponse(
    body.response ||
    body.intent ||
    body.extracted_data ||
    body.agent_extraction ||
    body.custom_extractions ||
    body.summary ||
    body.data?.response ||
    body.data?.extracted_data ||
    body.output?.response ||
    body.output?.result ||
    body.output_text ||
    body.text ||
    body.message ||
    body.answer ||
    body.ai_response ||
    body.response_object ||
    body.reply
  );
};

const normalizeTranscriptText = (transcript) => {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (!entry || typeof entry !== "object") return "";
        return entry.text || entry.transcript || entry.content || "";
      })
      .filter(Boolean)
      .join(" ");
  }
  if (typeof transcript === "object") {
    return transcript.text || transcript.transcript || transcript.content ||
      Object.values(transcript).filter((value) => typeof value === "string").join(" ") || "";
  }
  return "";
};

const normalizeEventValue = (value) => String(value || "").toLowerCase().trim();

const extractLifecycleStatus = (body) => {
  const candidates = [
    body.status,
    body.call_status,
    body.callStatus,
    body.callState,
    body.state,
    body.event,
    body.type,
    body.action,
    body.dial_status,
    body.telephony_data?.status,
    body.telephony_data?.call_status,
    body.telephony_data?.callStatus,
  ];
  return candidates
    .filter((value) => value != null)
    .map(normalizeEventValue)
    .find(Boolean);
};

const isTerminalLifecycleStatus = (status) => {
  if (!status) return false;
  return [
    "completed",
    "ended",
    "finished",
    "hangup",
    "terminated",
    "answered",
    "no-answer",
    "no_answer",
    "unanswered",
    "failed",
    "busy",
    "rejected",
    "completed_with_no_response",
  ].some((term) => status.includes(term));
};

const shouldProcessWebhook = (body, responseString, transcriptText) => {
  const lifecycleStatus = extractLifecycleStatus(body);
  if (lifecycleStatus) {
    if (isTerminalLifecycleStatus(lifecycleStatus)) return true;
    if (responseString || transcriptText) return true;
    return false;
  }
  return Boolean(responseString || transcriptText);
};

const extractIntent = (transcriptText, phase = 1) => {
  if (!transcriptText) return "";

  const cleaned = transcriptText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(user|customer|caller|agent|jarvis|bot):\s*/i, ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matchAny = (terms) => terms.some((term) => cleaned.includes(term));

  if (phase === 1) {
    if (matchAny([
      "yes", "confirm", "haan", "ha", "confirmed",
      "theek hai", "bilkul", "rakh lo", "ji haan",
      "kar do", "karo", "ho jaye"
    ])) return "confirmed";

    if (matchAny([
      "no", "cancel", "nahi", "nai", "band karo",
      "nahi chahiye", "ji nahi", "mat karo", "cancel karo"
    ])) return "cancelled";

    return "";
  }

  if (phase === 2) {
    if (matchAny([
      "reschedule", "change", "baad mein",
      "later", "alag", "different", "slot change"
    ])) return "rescheduled";

    if (matchAny([
      "keep", "same", "theek hai", "theek",
      "rakhna", "thik", "rakh lo", "same slot"
    ])) return "keep";

    return "";
  }

  return "";
};

router.post("/bolna", async (req, res) => {
  // Verify webhook signature if secret is configured
  if (!verifyWebhookSignature(req, env.bolnaWebhookSecret)) {
    console.warn("[Webhook] ❌ Invalid signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    const body = JSON.parse(req.body.toString("utf8"));
    console.log(
      "[Webhook] FULL context_details:",
      JSON.stringify(body.context_details, null, 2)
    );
    const { orderId, phase: rawPhase, callId, recipientData } = extractWebhookMetadata(body);

    const phase = Number(rawPhase ?? 1);
    const transcriptText = normalizeTranscriptText(body.transcript);
    const response = getWebhookResponse(body);
    const inferredResponse =
      response.decision || response.reply || response.intent || response.status || response.raw || "";
    const transcriptIntent = extractIntent(transcriptText, phase);
    const responseString = transcriptIntent || inferredResponse || transcriptText || "";

    console.log(`[Webhook] Received — orderId: ${orderId}, phase: ${phase}, response: "${JSON.stringify(response)}", responseString: "${responseString}"`);

    if (!shouldProcessWebhook(body, responseString, transcriptText)) {
      console.log("[Webhook] Skipping non-terminal webhook event; keeping order status unchanged.");
      return res.status(200).json({ ok: true });
    }

    // Debug logging for payload inspection
    console.log("[Webhook] Debug - context_details keys:", body.context_details ? Object.keys(body.context_details) : 'null');
    console.log("[Webhook] Debug - extracted_data keys:", body.extracted_data ? Object.keys(body.extracted_data) : 'null');
    console.log("[Webhook] Debug - agent_extraction keys:", body.agent_extraction ? Object.keys(body.agent_extraction) : 'null');
    console.log("[Webhook] Debug - metadata:", body.metadata);
    console.log("[Webhook] Debug - recipientData found:", recipientData);
    console.log("[Webhook] Debug - parsed response:", response);

    if (!orderId) {
      console.warn("[Webhook] ❌ Missing orderId — skipping");
      console.warn("[Webhook] Payload summary:", {
        rootKeys: Object.keys(body),
        detectedPayload: {
          orderId: body.orderId || body.order_id || body.orderID,
          metadata: body.metadata,
          recipient_data: body.context_details?.recipient_data || body.context?.recipient_data || body.recipient_data || body.data?.recipient_data,
        },
        nestedRecipientData: recipientData,
      });
      return res.status(200).json({ ok: true });
    }

    const finalCallId = callId || body.call_id || body.execution_id || `manual_${Date.now()}`;

    const durationSec = Number(
      body.telephony_data?.duration ||
      body.durationSec ||
      body.duration ||
      40
    );

    const transcript = transcriptText
      ? transcriptText.split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const match = line.match(/^(assistant|user):\s*(.*)$/i);

            return {
               speaker: match?.[1] || "unknown",
               text: match?.[2] || line.trim()
            };
          })
      : [];

    const updated = await emitCallCompleted({ orderId, phase, response: responseString, callId: finalCallId, durationSec, transcript });

    if (!updated) {
      console.warn(`[Webhook] ❌ Order not found in DB: ${orderId}`);
    } else {
      console.log(`[Webhook] ✅ Order ${orderId} updated — phase ${phase}, response: "${JSON.stringify(response)}"`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
module.exports.extractIntent = extractIntent;
module.exports.getWebhookResponse = getWebhookResponse;
module.exports.extractWebhookMetadata = extractWebhookMetadata;
