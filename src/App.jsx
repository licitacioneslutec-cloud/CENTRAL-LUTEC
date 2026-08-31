import { useState } from "react";
import Portal from "./components/Portal";

// TODO: replace placeholder with real component once it exists:
//   import FacturasModule from "./components/FacturasModule";
export default function App() {
  const [view, setView] = useState("portal");
  const [role, setRole] = useState(null);

  if (view === "facturas") {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>Facturas Module (placeholder)</h1>
        <p>Role: {role ?? "none"}</p>
        <button onClick={() => setView("portal")}>Volver al portal</button>
      </div>
    );
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
