const { env } = require("../config/env");
const { getOrder, updateOrder } = require("../data/store");
const { triggerBolnaCall, applyWebhookDecision, deliveryDefault } = require("../services/callService");
const { schedulePhaseTwoCall } = require("../services/schedulerService");

const callMetadata = (order, phase) => ({
  orderId: order.id,
  phase,
  customerName: order.customer.name,
  productName: order.product.name,
  amount: order.product.amount,
  ...(phase === 2 && { deliverySlot: order.deliverySlot || deliveryDefault }),
});

const emitOrderCreated = async (orderId) => {
  const order = await getOrder(orderId);
  if (!order) return null;
  // Don't trigger call immediately - set status to "Pending" and let scheduler handle it
  await updateOrder(orderId, {
    status: "Pending",
    workflowPhase: 1,
    nextActionAt: new Date().toISOString(), // Set to now so scheduler picks it up immediately
  });
  return getOrder(orderId);
};

const emitCallCompleted = async ({ orderId, phase, response, callId, durationSec, transcript }) => {
  const result = await applyWebhookDecision({
    orderId,
    phase,
    response,
    callId,
    durationSec,
    transcript,
  });
  if (!result) return null;

  const { order: updated, duplicate } = result;
  if (!duplicate && updated.status === "Confirmed") {
    await schedulePhaseTwoCall(orderId);
  }

  if (!duplicate && updated.status === "Retry Pending" && updated.retryCount < updated.maxRetries) {
    await updateOrder(orderId, {
      nextActionAt: new Date(Date.now() + env.retryDelayMinutes * 60 * 1000).toISOString(),
    });
  }

  return getOrder(orderId);
};

module.exports = { emitOrderCreated, emitCallCompleted };
