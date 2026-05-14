import { useEffect, useMemo, useRef, useState } from "react";
import OrderTable from "../components/OrderTable";
import { fetchCallLogs, fetchOrders, simulateOrder, deleteOrder } from "../services/api";

function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const previousMap = useRef({});

  const showToast = (message) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, logsRes] = await Promise.all([fetchOrders(), fetchCallLogs()]);
        setOrders(ordersRes.data.orders);
        setLogs(logsRes.data.logs);

        ordersRes.data.orders.forEach((order) => {
          const old = previousMap.current[order.id];
          if (old && old !== order.status) {
            if (order.status === "Confirmed") showToast(`Order confirmed for ${order.customer.name}`);
            if (order.status === "Rescheduled") showToast(`Delivery rescheduled for ${order.customer.name}`);
          }
          previousMap.current[order.id] = order.status;
        });
      } catch {
        /* backend may be starting or unreachable */
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const overview = useMemo(() => {
    const total = orders.length;
    const confirmed = orders.filter((o) => ["Confirmed", "Slot Confirmed", "Rescheduled"].includes(o.status)).length;
    const cancelled = orders.filter((o) => o.status === "Cancelled").length;
    const pendingCalls = orders.filter((o) => o.status.startsWith("Calling") || o.status === "Retry Pending" || o.status === "Pending").length;
    return { total, confirmed, cancelled, pendingCalls };
  }, [orders]);

  const simulate = async (orderId, payload) => {
    try {
      await simulateOrder(orderId, payload);
      showToast("Simulation event applied");
    } catch {
      showToast("Simulation failed — check API");
    }
  };

  const handleDelete = async (orderId) => {
    try {
      const response = await deleteOrder(orderId);
      if (response?.status === 200) {
        const ordersRes = await fetchOrders();
        setOrders(ordersRes.data.orders);
        showToast("Order record cleared");
        return;
      }
      showToast("Failed to delete order");
    } catch (err) {
      console.error("[DashboardPage] handleDelete error", err);
      showToast("Failed to delete order");
    }
  };

  return (
    <>
      <section className="overview-grid">
        <div className="card metric">
          <p>Total Orders</p>
          <h3>{overview.total}</h3>
        </div>
        <div className="card metric">
          <p>Confirmed</p>
          <h3>{overview.confirmed}</h3>
        </div>
        <div className="card metric">
          <p>Cancelled</p>
          <h3>{overview.cancelled}</h3>
        </div>
        <div className="card metric">
          <p>Pending Calls</p>
          <h3>{overview.pendingCalls}</h3>
        </div>
      </section>
      <OrderTable orders={orders} onSimulate={simulate} onDelete={handleDelete} />
      <section className="card">
        <h2>Recent Call Activity</h2>
        <ul className="activity-list">
          {logs.slice(0, 6).map((log) => (
            <li key={`${log.callId}_${log.timestamp}`}>
              <strong>{log.customer}</strong> — Phase {log.phase} — {log.response} ({log.status})
            </li>
          ))}
        </ul>
      </section>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}

export default DashboardPage;
