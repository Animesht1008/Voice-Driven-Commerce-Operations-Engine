const { env } = require("../config/env");
const { getOrder, getOrdersNeedingAction, updateOrder } = require("../data/store");
const { triggerBolnaCall } = require("./callService");

let intervalHandle = null;
let isProcessing = false;

const scheduleNextAction = async (orderId, whenIso) => {
  await updateOrder(orderId, { nextActionAt: whenIso });
};

const schedulePhaseTwoCall = async (orderId) => {
  const delayMs = env.simulationMode ? 30000 : env.retryDelayMinutes * 60 * 1000;
  await scheduleNextAction(orderId, new Date(Date.now() + delayMs).toISOString());
};

const processPendingActions = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const dueOrders = await getOrdersNeedingAction(new Date());
    for (const order of dueOrders) {
      if (order.status === "Confirmed") {
        try {
          await updateOrder(order.id, { status: "Calling - Delivery Slot", nextActionAt: null });
          await triggerBolnaCall({ order, phase: 2 });
        } catch {
          await updateOrder(order.id, {
            status: "Retry Pending",
            nextActionAt: new Date(
              Date.now() + env.retryDelayMinutes * 60 * 1000
            ).toISOString(),
          });
        }
        continue;
      }

      if (order.status === "Retry Pending" && order.retryCount < order.maxRetries) {
        const phase = order.deliverySlot ? 2 : 1;
        await updateOrder(order.id, {
          status: phase === 1 ? "Calling - Confirmation" : "Calling - Delivery Slot",
          nextActionAt: null,
          retryCount: order.retryCount + 1,
        });
        try {
          await triggerBolnaCall({ order, phase });
        } catch {
          await updateOrder(order.id, {
            status: "Retry Pending",
            nextActionAt: new Date(
              Date.now() + env.retryDelayMinutes * 60 * 1000
            ).toISOString(),
          });
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
