import { NavLink, Outlet } from "react-router-dom";
import { USING_MOCK } from "../api/client.js";

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">Resume Maxxer</NavLink>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      {USING_MOCK && (
        <div className="mock-banner">Demo mode: results are sample data until the backend is connected.</div>
      )}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
