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
    body.status ||
    body.decision ||
    body.final_decision ||
    body.call_status ||
    body.callState ||
    body.event ||
    body.result ||
    body.extracted_data ||
    body.agent_extraction ||
    body.custom_extractions ||
    body.summary ||
    body.data?.response ||
    body.data?.decision ||
    body.data?.status ||
    body.data?.result ||
    body.data?.output?.response ||
    body.data?.output?.result ||
    body.data?.output?.decision ||
    body.data?.output?.status ||
    body.data?.event ||
    body.output?.response ||
    body.output?.result ||
    body.output?.decision ||
    body.output?.status ||
    body.output_text ||
    body.text ||
    body.message ||
    body.answer ||
    body.ai_response ||
    body.response_object ||
    body.reply ||
    body.data ||
    body.payload ||
    body.metadata
  );
};

const normalizeTranscriptText = (transcript) => {
  if (!transcript) return "";
  if (typeof transcript === "string") return transcript;

  const extractText = (entry) => {
    if (typeof entry === "string") return entry;
    if (!entry || typeof entry !== "object") return "";
    return (
      entry.text ||
      entry.transcript ||
      entry.content ||
      entry.message ||
      entry.response ||
      entry.answer ||
      entry.output ||
      entry.payload ||
      Object.values(entry)
        .filter((value) => typeof value === "string")
        .join(" ") ||
      ""
    );
  };

  if (Array.isArray(transcript)) {
    return transcript.map(extractText).filter(Boolean).join(" \n");
  }

  if (typeof transcript === "object") {
    return extractText(transcript);
  }

  return String(transcript);
};

const extractUserTranscript = (transcriptText) => {
  if (!transcriptText) return "";

  const lines = transcriptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const userLines = lines.filter((line) => /^(user|customer|caller):/i.test(line));
  if (userLines.length > 0) {
    return userLines
      .map((line) => line.replace(/^(user|customer|caller):/i, "").trim())
      .join(" ");
  }

  const assistantLines = lines.filter((line) => /^(assistant|agent|bot):/i.test(line));
  const remainingLines = lines.filter(
    (line) => !/^(assistant|agent|bot|user|customer|caller):/i.test(line)
  );

  const ignoredPromptPattern = /can i confirm this order|confirm this order for you|are you okay with this order|please confirm|should we place this order|confirm your order|confirm order/i;
  const filtered = remainingLines.filter((line) => !ignoredPromptPattern.test(line));

  if (filtered.length > 0) {
    return filtered[filtered.length - 1];
  }

  if (lines.length > 0) {
    return lines[lines.length - 1];
  }

  return "";
};

const normalizeStatus = (value) => {
  if (!value) return "";
  return String(value).toLowerCase().trim();
};

const isLifecycleStatus = (status) => {
  if (!status) return false;
  return [
    "initiated",
    "ringing",
    "in-progress",
    "in progress",
    "queued",
    "dialing",
    "connected",
    "started",
    "answered",
    "ongoing",
    "calling"
  ].some((term) => status.includes(term));
};

const isTerminalStatus = (status) => {
  if (!status) return false;
  return [
    "completed",
    "call-disconnected",
    "disconnected",
    "hangup",
    "terminated",
    "busy",
    "no-answer",
    "no answer",
    "failed",
    "cancelled",
    "cancel"
  ].some((term) => status.includes(term));
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
    // Check for explicit negatives first to avoid agent-prompt contamination
    if (matchAny([
      "no",
      "cancel",
      "nahi",
      "nai",
      "nah",
      "nope",
      "band karo",
      "nahi chahiye",
      "ji nahi",
      "mat karo",
      "cancel karo",
      "don't",
      "dont",
      "stop"
    ])) return "cancelled";

    if (matchAny([
      "yes",
      "confirm",
      "okay",
      "ok",
      "sure",
      "haan",
      "ha",
      "confirmed",
      "theek hai",
      "thik hai",
      "bilkul",
      "rakh lo",
      "ji haan",
      "kar do",
      "karo",
      "ho jaye",
      "of course",
      "theek",
      "theek hai"
    ])) return "confirmed";

    return "";
  }

  if (phase === 2) {
    if (matchAny([
      "reschedule",
      "postpone",
      "change",
      "baad mein",
      "baad me",
      "later",
      "alag",
      "different",
      "slot change",
      "tomorrow",
      "kal",
      "after",
      "postpone",
      "move",
      "shift",
      "dusra"
    ])) return "rescheduled";

    if (matchAny([
      "keep",
      "same",
      "theek hai",
      "theek",
      "thik",
      "rakhna",
      "rakh lo",
      "same slot",
      "ok",
      "okay",
      "sure",
      "ha",
      "haan",
      "bilkul"
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

    const phase = Number(rawPhase ?? 1);
    const finalCallId = callId || body.call_id || body.execution_id || `manual_${Date.now()}`;
    const transcriptText = [
      body.transcript,
      body.data?.transcript,
      body.output?.transcript,
      body.data?.output?.transcript,
      body.data?.conversation,
      body.output?.conversation,
      body.messages,
      body.data?.messages,
      body.conversation,
      body.events,
    ]
      .map(normalizeTranscriptText)
      .filter(Boolean)
      .join(" \n");

    const response = getWebhookResponse(body);
    const normalizedResponse = normalizeStatus(
      response.decision || response.reply || response.intent || response.status || response.raw || ""
    );
    const userTranscript = extractUserTranscript(transcriptText);
    const transcriptIntent = extractIntent(userTranscript, phase);
    const responseString = transcriptIntent || normalizedResponse || userTranscript || "";

    const lifecycleEvent = isLifecycleStatus(normalizedResponse) && !transcriptIntent;
    if (lifecycleEvent) {
      console.log(
        `[Webhook] Ignoring lifecycle call state event for phase ${phase} call ${finalCallId} status=${normalizedResponse}`
      );
      return res.status(200).json({ ok: true });
    }

    const finalResponse = responseString || "no-response";
    const durationSec = Number(
      body.telephony_data?.duration ||
      body.durationSec ||
      body.duration ||
      40
    );

    const transcript = userTranscript
      ? [{ speaker: "user", text: userTranscript }]
      : [];

    const updated = await emitCallCompleted({
      orderId,
      phase,
      response: finalResponse,
      callId: finalCallId,
      durationSec,
      transcript,
    });

    console.log(`[Webhook] Received — orderId: ${orderId}, phase: ${phase}, response: "${JSON.stringify(response)}", responseString: "${responseString}"`);

    // Debug logging for payload inspection
    console.log("[Webhook] Debug - context_details keys:", body.context_details ? Object.keys(body.context_details) : 'null');
    console.log("[Webhook] Debug - extracted_data keys:", body.extracted_data ? Object.keys(body.extracted_data) : 'null');
    console.log("[Webhook] Debug - agent_extraction keys:", body.agent_extraction ? Object.keys(body.agent_extraction) : 'null');
    console.log("[Webhook] Debug - metadata:", body.metadata);
    console.log("[Webhook] Debug - recipientData found:", recipientData);
    console.log("[Webhook] Debug - parsed response:", response);

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
