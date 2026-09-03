import { C } from "../constants";
import { fmt } from "../utils";

// ─── Summary stats line ───
export default function StatsBar({ stats, role }) {
  const emphasizeSinRta = role === "compras";
  return (
    <div style={{ fontSize: 11, color: C.g500 }}>
      Total: <strong style={{ color: C.navy }}>{fmt(stats.totalVal)}</strong> · Sin respuesta:{" "}
      <strong style={{ color: C.red, fontSize: emphasizeSinRta ? 13 : 11 }}>{stats.sinRta}</strong>
      {stats.pendienteRevision > 0 && (
        <>
          {" "}
          · Pend. revisión: <strong style={{ color: C.green }}>{stats.pendienteRevision}</strong>
        </>
      )}
    </div>
  );
}
