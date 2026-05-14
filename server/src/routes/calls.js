const express = require("express");
const { listOrders } = require("../data/store");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const orders = await listOrders();
    const logs = orders.flatMap((order) =>
      (order.callLogs || []).map((log) => ({
        orderId: order.id,
        customer: order.customer.name,
        phone: order.customer.phone,
        product: order.product.name,
        ...log,
      }))
    );
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ logs });
  } catch (err) {
    console.error("[calls] GET /", err.message);
    res.status(500).json({ error: "Failed to load call logs." });
  }
});

module.exports = router;
