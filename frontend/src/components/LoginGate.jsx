import { useState, useEffect } from "react";
import { verifyToken } from "../api/client";

export default function LoginGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // On mount, check if we already have a valid token in localStorage.
  useEffect(() => {
    const stored = localStorage.getItem("app_token");
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false);
      return;
    }
    verifyToken(stored)
      .then(() => setAuthed(true))
      .catch(() => {
        localStorage.removeItem("app_token");
      })
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyToken(password);
      localStorage.setItem("app_token", password);
      setAuthed(true);
    } catch {
      setError("Incorrect password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;
  if (authed) return children;

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">ResumeForge</h1>
        <p className="login-sub">Enter your access password to continue.</p>
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <p className="login-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
