import { useState } from "react";
import Portal from "./components/Portal";
import FacturasModule from "./components/FacturasModule";

export default function App() {
  const [view, setView] = useState("portal");
  const [role, setRole] = useState(null);

  if (view === "facturas") {
    return <FacturasModule role={role} onBack={() => setView("portal")} />;
  }

  return (
    <Portal
      onNavigate={(target, navRole) => {
        setRole(navRole);
        setView(target);
      }}
    />
  );
}
