import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { USING_MOCK, getStatus } from "../api/client.js";

export default function Layout() {
  const [status, setStatus] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (USING_MOCK) return;
    getStatus().then(setStatus).catch(() => setOffline(true));
  }, []);

  let banner = null;
  if (USING_MOCK) banner = "Demo mode: results are sample data until the backend is connected.";
  else if (offline) banner = "Can't reach the backend. Start it with: uvicorn resume_maxxer.api:app --port 8000";
  else if (status && !status.llmConfigured)
    banner = "No Anthropic API key is set on the server. Add ANTHROPIC_API_KEY to .env to enable grading and rewrites.";

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">Resume Maxxer</NavLink>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/upload">Upload</NavLink>
          <NavLink to="/prompts">Prompts</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      {banner && <div className="mock-banner">{banner}</div>}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
