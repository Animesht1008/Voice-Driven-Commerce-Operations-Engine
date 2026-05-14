const statusMap = {
  Pending: "status-grey",
  "Calling - Confirmation": "status-blue",
  "Calling - Delivery Slot": "status-blue",
  Confirmed: "status-green",
  Cancelled: "status-red",
  "Slot Confirmed": "status-green",
  Rescheduled: "status-yellow",
  "Retry Pending": "status-orange",
};

function StatusBadge({ status }) {
  const isCalling = status?.startsWith("Calling");
  return (
    <span className={`status-pill ${statusMap[status] || "status-grey"} ${isCalling ? "pulse" : ""}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
