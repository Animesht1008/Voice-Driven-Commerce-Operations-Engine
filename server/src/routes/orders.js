const express = require("express");
const { env } = require("../config/env");
const { createOrder, listOrders, getOrder, updateOrder, deleteOrder } = require("../data/store");
const { emitOrderCreated, emitCallCompleted } = require("../workflow/workflowEngine");

const router = express.Router();

/** E.164: + then country code and subscriber (10–15 digits total after +). */
const PHONE_E164 = /^\+[1-9]\d{9,14}$/;

router.get("/", async (_req, res) => {
  try {
    const orders = await listOrders();
    res.json({ orders });
  } catch (err) {
    console.error("[orders] GET /", err.message);
    res.status(500).json({ error: "Failed to list orders." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, phone, product, amount, address, language = "en" } = req.body;
    if (!name || !phone || !product || !amount || !address) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const phoneNorm = String(phone).trim();
    if (!PHONE_E164.test(phoneNorm)) {
      return res.status(400).json({
        error: "Invalid phone. Use E.164 format, e.g. +919876543210.",
      });
    }

    const order = await createOrder({
      customer: { name, phone: phoneNorm },
      product: { name: product, amount: Number(amount) },
      address,
      language,
      status: "Pending",
      deliverySlot: null,
      workflowPhase: 1,
      retryCount: 0,
      maxRetries: env.maxRetries,
      nextActionAt: null,
    });

    const updated = await emitOrderCreated(order.id);
    return res.status(201).json({ order: updated });
  } catch (err) {
    console.error("[orders] POST /", err.message);
    res.status(500).json({ error: "Failed to create order." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found." });
    const updatedOrder = await updateOrder(req.params.id, req.body);
    res.json({ order: updatedOrder });
  } catch (err) {
    console.error("[orders] PATCH /:id", err.message);
    res.status(500).json({ error: "Failed to update order." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteOrder(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Order not found." });
    res.json({ message: "Order deleted successfully." });
  } catch (err) {
    console.error("[orders] DELETE /:id", err.message);
    res.status(500).json({ error: "Failed to delete order." });
  }
});

router.post("/:id/simulate", async (req, res) => {
  try {
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
  } catch (err) {
    console.error("[orders] POST /:id/simulate", err.message);
    res.status(500).json({ error: "Simulation failed." });
  }
});

module.exports = router;
