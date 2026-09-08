import { useState, useEffect, Component } from "react";
import Portal from "./components/Portal";
import FacturasModule from "./components/FacturasModule";
import AdminPanel from "./components/AdminPanel";
import LoginScreen from "./components/LoginScreen";
import { isFirebaseConfigured, initFirebase, seedAdmin } from "./firebase";
import { hashPassword } from "./components/PasswordGate";
import { C } from "./constants";

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
          <h2 style={{ color: C.red, fontSize: 16 }}>Ocurrió un error inesperado</h2>
          <p style={{ color: C.g500, fontSize: 13 }}>{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ background: C.navy, color: C.white, border: "none", padding: "8px 20px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState("portal");
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      const s = sessionStorage.getItem("lutec_session");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const db = initFirebase();
    hashPassword("lutec2026").then((h) => seedAdmin(db, h));
  }, []);

  const handleLogin = (session) => {
    try { sessionStorage.setItem("lutec_session", JSON.stringify(session)); } catch {}
    setUser(session);
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem("lutec_session"); } catch {}
    setUser(null);
    setView("portal");
  };

  const handleNavigate = (target, navRole) => {
    setRole(navRole);
    setView(target);
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  let content;
  if (view === "admin" && user.role === "admin") {
    content = <AdminPanel user={user} onBack={() => setView("portal")} />;
  } else if (view === "facturas") {
    const effectiveRole = role || (user.role === "admin" ? "contabilidad" : user.role);
    content = <FacturasModule user={user} role={effectiveRole} onBack={() => setView("portal")} />;
  } else {
    content = <Portal user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
