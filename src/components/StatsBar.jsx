import { C } from "../constants";
import { fmt } from "../utils";

export default function StatsBar({ stats, filteredStats, role }) {
  const emphasizeSinRta = role === "compras";
  const isFiltered = filteredStats.count < stats.total;
  return (
    <div style={{ fontSize: 11, color: C.g500 }}>
      Total: <strong style={{ color: C.navy }}>{fmt(filteredStats.totalVal)}</strong>
      {isFiltered && (
        <span> ({filteredStats.count} de {stats.total} facturas)</span>
      )}
      {" · "}IVA: <strong style={{ color: C.navy }}>{fmt(filteredStats.totalIva)}</strong>
      {" · "}Sin respuesta:{" "}
      <strong style={{ color: C.red, fontSize: emphasizeSinRta ? 13 : 11 }}>{stats.sinRta}</strong>
      {stats.pendienteRevision > 0 && (
        <>
          {" · "}Pend. revisión: <strong style={{ color: C.green }}>{stats.pendienteRevision}</strong>
        </>
      )}
    </div>
  );
}
