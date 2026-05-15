const statusMeta = {
  Pending: { label: "⏳ Pending", className: "status-grey" },
  "Calling - Confirmation": { label: "📞 Calling - Confirmation", className: "status-blue" },
  "Calling - Delivery Slot": { label: "📞 Calling - Delivery Slot", className: "status-blue" },
  Confirmed: { label: "✅ Confirmed", className: "status-green" },
  Cancelled: { label: "❌ Cancelled", className: "status-red" },
  "Slot Confirmed": { label: "✅ Slot Confirmed", className: "status-green" },
  Rescheduled: { label: "🔄 Rescheduled", className: "status-yellow" },
  "Retry Pending": { label: "🔁 Retry Pending", className: "status-orange" },
};

function StatusBadge({ status }) {
  const meta = statusMeta[status] || { label: status, className: "status-grey" };
  const isCalling = status?.startsWith("Calling");
  return (
    <span className={`status-pill ${meta.className} ${isCalling ? "pulse" : ""}`}>
      {meta.label}
    </span>
  );
}

export default StatusBadge;
