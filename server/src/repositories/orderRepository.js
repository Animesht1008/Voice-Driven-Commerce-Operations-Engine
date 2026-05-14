const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { env } = require("../config/env");
const Order = require("../models/Order");

const dbPath = path.join(process.cwd(), "src", "data", "db.json");

// Add safety check for Render deployment
if (env.storageMode === "json" && process.env.NODE_ENV === "production") {
  console.warn("[Store] ⚠️ WARNING: JSON storage in production will lose data on redeploy. Use STORAGE_MODE=mongo");
}

const ensureDb = async () => {
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify({ orders: [] }, null, 2), "utf8");
  }
};

const readDb = async () => {
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  return JSON.parse(raw);
};

const writeDb = async (db) => {
  // NOTE: JSON storage has no write locking — concurrent writes may
  // conflict. Use STORAGE_MODE=mongo for production reliability.
  return fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
};

const withId = (order) => {
  if (!order) return null;
  const value = typeof order.toObject === "function" ? order.toObject() : order;
  return { ...value, id: value._id?.toString?.() || value.id };
};

const listOrders = async () => {
  try {
    if (env.storageMode === "mongo") {
      const orders = await Order.find().sort({ createdAt: -1 }).lean();
      return orders.map(withId);
    }
    const db = await readDb();
    return db.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error("[Store] listOrders error:", err.message);
    return [];
  }
};

const getOrder = async (id) => {
  try {
    if (!id) return null;
    if (env.storageMode === "mongo") {
      const byId = await Order.findById(id);
      if (byId) return withId(byId);
      return withId(
        await Order.findOne({
          $or: [
            { id },
            { orderId: id },
            { order_id: id },
            { _id: id },
          ],
        })
      );
    }

    const db = await readDb();
    return (
      db.orders.find(
        (o) =>
          o.id === id ||
          o._id === id ||
          o.orderId === id ||
          o.order_id === id
      ) ||
      null
    );
  } catch (err) {
    console.error("[Store] getOrder error:", err.message);
    return null;
  }
};

const createOrder = async (payload) => {
  try {
    if (env.storageMode === "mongo") return withId(await Order.create(payload));
    const db = await readDb();
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      ...payload,
      callLogs: payload.callLogs || [],
      createdAt: now,
      updatedAt: now,
    };
    db.orders.push(order);
    await writeDb(db);
    return order;
  } catch (err) {
    console.error("[Store] createOrder error:", err);
    throw err;
  }
};

const updateOrder = async (id, updates) => {
  try {
    if (env.storageMode === "mongo") {
      return withId(
        await Order.findByIdAndUpdate(id, updates, { returnDocument: "after" })
      );
    }
    const db = await readDb();
    const idx = db.orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    db.orders[idx] = {
      ...db.orders[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await writeDb(db);
    return db.orders[idx];
  } catch (err) {
    console.error("[Store] updateOrder error:", err.message);
    return null;
  }
};

const appendCallLog = async (id, log) => {
  try {
    if (env.storageMode === "mongo") {
      await Order.findByIdAndUpdate(
        id,
        { $push: { callLogs: log }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      return getOrder(id);
    }
    const order = await getOrder(id);
    if (!order) return null;
    const callLogs = [...(order.callLogs || []), log];
    return updateOrder(id, { callLogs });
  } catch (err) {
    console.error("[Store] appendCallLog error:", err.message);
    return null;
  }
};

const getOrdersNeedingAction = async (now) => {
  if (env.storageMode === "mongo") {
    const orders = await Order.find({
      nextActionAt: { $ne: null, $lte: now },
      status: { $in: ["Pending", "Retry Pending", "Confirmed", "Calling - Confirmation", "Calling - Delivery Slot"] },
    })
      .sort({ nextActionAt: 1 })
      .lean();
    return orders.map(withId);
  }
  const db = await readDb();
  return db.orders.filter((o) =>
    o.nextActionAt &&
    new Date(o.nextActionAt) <= now &&
    [
      "Pending",
      "Retry Pending",
      "Confirmed",
      "Calling - Confirmation",
      "Calling - Delivery Slot",
    ].includes(o.status)
  );
};

const deleteOrder = async (id) => {
  if (env.storageMode === "mongo") {
    const deleted = await Order.findByIdAndDelete(id);
    return Boolean(deleted);
  }
  const db = await readDb();
  const idx = db.orders.findIndex((o) => o.id === id);
  if (idx === -1) return false;
  db.orders.splice(idx, 1);
  await writeDb(db);
  return true;
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  appendCallLog,
  getOrdersNeedingAction,
};
