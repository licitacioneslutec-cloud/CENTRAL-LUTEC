import { useState } from "react";
import Portal from "./components/Portal";
import FacturasModule from "./components/FacturasModule";
import PasswordGate from "./components/PasswordGate";

export default function App() {
  const [view, setView] = useState("portal");
  const [role, setRole] = useState(null);
  const [pendingAuth, setPendingAuth] = useState(null);

  const handleNavigate = (target, navRole, passwordHash) => {
    const authKey = `auth_${target}_${navRole}`;
    if (passwordHash && !sessionStorage.getItem(authKey)) {
      setPendingAuth({ target, role: navRole, passwordHash, authKey });
      return;
    }
    setRole(navRole);
    setView(target);
  };

  if (pendingAuth) {
    return (
      <PasswordGate
        moduleId={pendingAuth.target}
        role={pendingAuth.role}
        passwordHash={pendingAuth.passwordHash}
        onSuccess={() => {
          sessionStorage.setItem(pendingAuth.authKey, "1");
          setRole(pendingAuth.role);
          setView(pendingAuth.target);
          setPendingAuth(null);
        }}
        onCancel={() => setPendingAuth(null)}
      />
    );
  }

  if (view === "facturas") {
    return <FacturasModule role={role} onBack={() => setView("portal")} />;
  }

  return <Portal onNavigate={handleNavigate} />;
}
