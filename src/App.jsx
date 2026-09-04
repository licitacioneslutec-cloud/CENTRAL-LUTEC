import { useState, useEffect } from "react";
import Portal from "./components/Portal";
import FacturasModule from "./components/FacturasModule";
import AdminPanel from "./components/AdminPanel";
import LoginScreen from "./components/LoginScreen";
import { isFirebaseConfigured, initFirebase, seedAdmin } from "./firebase";
import { hashPassword } from "./components/PasswordGate";

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

  if (view === "admin" && user.role === "admin") {
    return <AdminPanel user={user} onBack={() => setView("portal")} />;
  }

  if (view === "facturas") {
    const effectiveRole = role || (user.role === "admin" ? "contabilidad" : user.role);
    return <FacturasModule user={user} role={effectiveRole} onBack={() => setView("portal")} />;
  }

  return <Portal user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
}
