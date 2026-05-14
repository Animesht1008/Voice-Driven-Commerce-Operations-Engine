const express = require("express");
const { listOrders } = require("../data/store");

const router = express.Router();

router.get("/", async (_req, res) => {
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
});

module.exports = router;
