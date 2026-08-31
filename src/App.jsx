import { useState } from "react";

// TODO: replace placeholders with real components once they exist:
//   import Portal from "./components/Portal";
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
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Portal Corporativo Lutec (placeholder)</h1>
      <button
        onClick={() => {
          setRole("admin");
          setView("facturas");
        }}
      >
        Ir a Facturas
      </button>
    </div>
  );
}
