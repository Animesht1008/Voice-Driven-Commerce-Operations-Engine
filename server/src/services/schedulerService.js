const { env } = require("../config/env");
const { getOrder, getOrdersNeedingAction, updateOrder } = require("../data/store");
const { triggerBolnaCall, deliveryDefault } = require("./callService");

let intervalHandle = null;
let isProcessing = false;

const scheduleNextAction = async (orderId, whenIso) => {
  await updateOrder(orderId, { nextActionAt: whenIso });
};

const schedulePhaseTwoCall = async (orderId) => {
  const delayMs = env.simulationMode ? 30000 : env.phase2DelayMinutes * 60 * 1000;
  await scheduleNextAction(orderId, new Date(Date.now() + delayMs).toISOString());
};

const scheduleCallRetry = async (orderId, status) => {
  await updateOrder(orderId, {
    status,
    nextActionAt: new Date(Date.now() + env.retryDelayMinutes * 60 * 1000).toISOString(),
  });
};

const processPendingActions = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const dueOrders = await getOrdersNeedingAction(new Date());
    for (const order of dueOrders) {
      if (order.status === "Pending") {
        try {
          await updateOrder(order.id, {
            status: "Calling - Confirmation",
            nextActionAt: null,
            workflowPhase: 1,
          });
          const fresh = await getOrder(order.id);
          await triggerBolnaCall({
            order: fresh,
            phase: 1,
            metadata: {
              orderId: fresh.id,
              phase: 1,
              customerName: fresh.customer.name,
              productName: fresh.product.name,
              amount: fresh.product.amount,
            },
          });
        } catch {
          await scheduleCallRetry(order.id, "Calling - Confirmation");
        }
        continue;
      }

      if (order.status === "Confirmed") {
        try {
          await updateOrder(order.id, {
            status: "Calling - Delivery Slot",
            nextActionAt: null,
            workflowPhase: 2,
          });
          const fresh = await getOrder(order.id);
          await triggerBolnaCall({
            order: fresh,
            phase: 2,
            metadata: {
              orderId: fresh.id,
              phase: 2,
              customerName: fresh.customer.name,
              productName: fresh.product.name,
              amount: fresh.product.amount,
              deliverySlot: fresh.deliverySlot || deliveryDefault,
            },
          });
        } catch {
          await scheduleCallRetry(order.id, "Calling - Delivery Slot");
        }
        continue;
      }

      if (order.status === "Retry Pending" && order.retryCount < order.maxRetries) {
        const phase = order.workflowPhase || 1;
        await updateOrder(order.id, {
          status: phase === 1 ? "Calling - Confirmation" : "Calling - Delivery Slot",
          nextActionAt: null,
          retryCount: order.retryCount + 1,
        });
        const fresh = await getOrder(order.id);
        try {
          await triggerBolnaCall({
            order: fresh,
            phase,
            metadata: {
              orderId: fresh.id,
              phase,
              customerName: fresh.customer.name,
              productName: fresh.product.name,
              amount: fresh.product.amount,
              ...(phase === 2 && { deliverySlot: fresh.deliverySlot || deliveryDefault }),
            },
          });
        } catch {
          await scheduleCallRetry(
            order.id,
            phase === 1 ? "Calling - Confirmation" : "Calling - Delivery Slot"
          );
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

const startScheduler = () => {
  if (intervalHandle) return;
  intervalHandle = setInterval(processPendingActions, env.workflowTickMs);
};

const stopScheduler = () => {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
};

module.exports = { schedulePhaseTwoCall, startScheduler, stopScheduler, processPendingActions };
