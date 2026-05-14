function CallLogTable({ logs, expandedId, onToggle }) {
  return (
    <div className="card">
      <h2>Call Logs</h2>
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Phase</th>
            <th>Call Status</th>
            <th>Response</th>
            <th>Duration</th>
            <th>Timestamp</th>
            <th>Transcript</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const rowKey = `${log.callId}_${log.timestamp}`;
            return [
              <tr key={rowKey}>
                <td>{log.customer}</td>
                <td>{log.phase}</td>
                <td>{log.status}</td>
                <td>{log.response}</td>
                <td>{log.durationSec ? `${log.durationSec}s` : "-"}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>
                  <button type="button" onClick={() => onToggle(rowKey)}>
                    View Conversation
                  </button>
                </td>
              </tr>,
              expandedId === rowKey && (
                <tr className="transcript-row" key={`${rowKey}_transcript`}>
                  <td colSpan={7}>
                    {(log.transcript || []).length === 0
                      ? "No transcript available."
                      : log.transcript.map((line, idx) => (
                          <p key={`${line.speaker}_${idx}`}>
                            <strong>{line.speaker}:</strong> {line.text}
                          </p>
                        ))}
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      {logs.length === 0 && <p>No call logs yet.</p>}
    </div>
  );
}

export default CallLogTable;
