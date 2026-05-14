const express = require("express");
const { createOrder, listOrders, getOrder, updateOrder, deleteOrder } = require("../data/store");
const { emitOrderCreated, emitCallCompleted } = require("../workflow/workflowEngine");

const router = express.Router();

router.get("/", async (_req, res) => {
  const orders = await listOrders();
  res.json({ orders });
});

router.post("/", async (req, res) => {
  const { name, phone, product, amount, address, language = "en" } = req.body;
  if (!name || !phone || !product || !amount || !address) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const order = await createOrder({
    customer: { name, phone },
    product: { name: product, amount: Number(amount) },
    address,
    language,
    status: "Pending",
    deliverySlot: null,
    retryCount: 0,
    maxRetries: 2,
    nextActionAt: null,
  });
  const updated = await emitOrderCreated(order.id);
  return res.status(201).json({ order: updated });
});

router.patch("/:id", async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const updatedOrder = await updateOrder(req.params.id, req.body);
  res.json({ order: updatedOrder });
});

router.delete("/:id", async (req, res) => {
  const deleted = await deleteOrder(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Order not found." });
  res.status(204).send();
});

router.post("/:id/simulate", async (req, res) => {
  const { scenario = "no-answer", phase = 1 } = req.body;
  const decision =
    scenario === "cancelled"
      ? "cancel"
      : scenario === "confirmed"
      ? "yes"
      : scenario === "rescheduled"
      ? "reschedule"
      : "no response";

  const order = await emitCallCompleted({
    orderId: req.params.id,
    phase: Number(phase),
    response: decision,
    callId: `sim_${Date.now()}`,
    durationSec: 25,
    transcript: [
      { speaker: "agent", text: "Simulation call transcript start." },
      { speaker: "customer", text: decision },
    ],
  });

  if (!order) return res.status(404).json({ error: "Order not found." });
  return res.json({ order });
});

module.exports = router;
