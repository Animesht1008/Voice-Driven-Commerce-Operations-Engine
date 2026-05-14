import { NavLink, Route, Routes } from "react-router-dom";
import CreateOrderPage from "./pages/CreateOrderPage";
import DashboardPage from "./pages/DashboardPage";
import CallLogsPage from "./pages/CallLogsPage";
import bgImage from "./assets/dashboard-bg.jpg";

function App() {
  return (
    <div className="app-shell" style={{ "--bg-image": `url(${bgImage})` }}>
      <header>
        <h1>Voice-Driven Commerce Operations Engine</h1>
        <nav>
          <NavLink to="/">Create Order</NavLink>
          <NavLink to="/dashboard">Operations Dashboard</NavLink>
          <NavLink to="/call-logs">Call Logs</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CreateOrderPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/call-logs" element={<CallLogsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
