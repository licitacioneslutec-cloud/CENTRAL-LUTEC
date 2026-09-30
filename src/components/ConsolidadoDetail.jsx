import { useState } from "react";
import { ALL_FIELDS, C } from "../constants";
import { fmt } from "../utils";

// Columns shown for a consolidado's facturas (read-only detail view).
const cols = ["folio", "nombreEmisor", "nitEmisor", "fechaEmision", "total", "estado", "nERP", "observacion", "rtaCompras", "rtaContabilidad"];

const th = {
  padding: "9px 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: C.white,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  background: C.navy,
  textAlign: "left",
};

const td = {
  padding: "8px",
  fontSize: 13,
  color: C.g900,
  borderBottom: `1px solid ${C.g200}`,
  whiteSpace: "nowrap",
};

const btn = {
  border: `1px solid ${C.g300}`,
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: C.white,
  color: C.navy,
};

// ─── Detail view of an archived consolidado: browse and restore facturas ───
export default function ConsolidadoDetail({ consolidado, onBack, onRestore, onRestoreAll, onDownload }) {
  const [selected, setSelected] = useState(() => new Set());

  const rows = Object.entries(consolidado.facturas || {}).map(([id, data]) => ({ ...data, id }));

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));

  const handleRestoreSelected = () => {
    if (!selected.size) return;
    if (!window.confirm(`¿Restaurar ${selected.size} factura(s) al tablero principal?`)) return;
    const entries = {};
    for (const r of rows) if (selected.has(r.id)) entries[r.id] = r;
    onRestore?.(entries);
  };

  const handleRestoreAll = () => {
    if (!window.confirm("¿Restaurar todas las facturas y eliminar este consolidado?")) return;
    onRestoreAll?.();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button style={{ ...btn, marginBottom: 10 }} onClick={onBack}>← Volver</button>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>{consolidado.nombre}</div>
          <div style={{ fontSize: 13, color: C.g500, marginTop: 2 }}>
            Desde {consolidado.fechaDesde} — Hasta {consolidado.fechaHasta} · {consolidado.cantidadFacturas} facturas
          </div>
        </div>
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...btn, opacity: selected.size ? 1 : 0.5, cursor: selected.size ? "pointer" : "not-allowed" }} disabled={!selected.size} onClick={handleRestoreSelected}>
              Restaurar seleccionadas
            </button>
            <button style={btn} onClick={handleRestoreAll}>Restaurar todas</button>
            <button style={{ ...btn, background: C.accent, color: C.white, borderColor: C.accentDark }} onClick={onDownload}>Descargar Excel</button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ color: C.g500, fontSize: 14 }}>Este consolidado no tiene facturas.</div>
      ) : (
        <div style={{ overflowX: "auto", background: C.white, borderRadius: 8, border: `1px solid ${C.g200}` }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>
                  <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} title="Seleccionar todas" />
                </th>
                {cols.map((key) => (
                  <th key={key} style={th}>{ALL_FIELDS.find((f) => f.key === key)?.label || key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ background: selected.has(r.id) ? C.g100 : C.white }}>
                  <td style={td}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                  </td>
                  {cols.map((key) => (
                    <td key={key} style={td}>{key === "total" ? fmt(r[key]) : r[key] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
