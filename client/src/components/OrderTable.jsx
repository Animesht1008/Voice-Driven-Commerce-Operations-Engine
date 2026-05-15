import StatusBadge from "./StatusBadge";

function OrderTable({ orders, onSimulate, onDelete }) {
  return (
    <div className="card">
      <h2>📋 Active Operations</h2>
      <table>
        <thead>
            <tr>
              <th>Customer</th>
              <th>Order</th>
              <th>Status</th>
              <th>Delivery Slot</th>
              <th>Manual Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.customer.name}</td>
              <td>{order.product.name}</td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td className="slot-cell">{order.deliverySlot || "-"}</td>
              <td className="actions">
                <button
                  type="button"
                  className="btn-confirm"
                  onClick={() => onSimulate(order.id, { scenario: "confirmed", phase: 1 })}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => onSimulate(order.id, { scenario: "cancelled", phase: 1 })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-muted"
                  onClick={() => onSimulate(order.id, { scenario: "no-answer", phase: 1 })}
                >
                  No Answer
                </button>
                <button
                  type="button"
                  className="btn-reschedule"
                  onClick={() => onSimulate(order.id, { scenario: "rescheduled", phase: 2 })}
                >
                  Reschedule
                </button>
                <button 
                  type="button" 
                  onClick={() => onDelete(order.id)}
                  className="btn-delete"
                  title="Clear call records"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p>No orders yet.</p>}
    </div>
  );
}

export default OrderTable;
