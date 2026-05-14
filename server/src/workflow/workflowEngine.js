const { env } = require("../config/env");
const { getOrder, updateOrder } = require("../data/store");
const { triggerBolnaCall, applyWebhookDecision } = require("../services/callService");
const { schedulePhaseTwoCall } = require("../services/schedulerService");

const emitOrderCreated = async (orderId) => {
  const order = await getOrder(orderId);
  if (!order) return null;
  await updateOrder(orderId, { status: "Calling - Confirmation" });
  try {
    await triggerBolnaCall({ order, phase: 1 });
  } catch (error) {
    await updateOrder(orderId, {
      status: "Retry Pending",
      nextActionAt: new Date(Date.now() + env.retryDelayMinutes * 60 * 1000).toISOString(),
    });
  }
  return getOrder(orderId);
};

const emitCallCompleted = async ({ orderId, phase, response, callId, durationSec, transcript }) => {
  const updated = await applyWebhookDecision({
    orderId,
    phase,
    response,
    callId,
    durationSec,
    transcript,
  });
  if (!updated) return null;

  if (updated.status === "Confirmed") {
    await schedulePhaseTwoCall(orderId);
  }

  if (updated.status === "Retry Pending" && updated.retryCount < updated.maxRetries) {
    const delayMs = env.retryDelayMinutes * 60 * 1000;
    await updateOrder(orderId, { nextActionAt: new Date(Date.now() + delayMs).toISOString() });
  }

  return getOrder(orderId);
};

module.exports = {
  emitOrderCreated,
  emitCallCompleted,
};
