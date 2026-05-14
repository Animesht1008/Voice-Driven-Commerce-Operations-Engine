import { useEffect, useState } from "react";
import CallLogTable from "../components/CallLogTable";
import { fetchCallLogs } from "../services/api";

function CallLogsPage() {
  const [logs, setLogs] = useState([]);
  const [expandedId, setExpandedId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await fetchCallLogs();
        setLogs(data.logs);
      } catch {
        /* ignore transient network errors */
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const toggle = (id) => setExpandedId((prev) => (prev === id ? "" : id));
  return <CallLogTable logs={logs} expandedId={expandedId} onToggle={toggle} />;
}

export default CallLogsPage;
