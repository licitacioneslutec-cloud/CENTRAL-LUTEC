import { useState, Fragment } from "react";
import { ALL_FIELDS, C, ESTADOS } from "../constants";
import { fmt } from "../utils";
import Badge from "./Badge";
import EditableCell from "./EditableCell";

// ─── Visible columns for the main table row ───
const mainCols = [
  "folio",
  "prefijo",
  "nombreEmisor",
  "nitEmisor",
  "fechaEmision",
  "iva",
  "total",
  "estado",
  "observacion",
  "rtaCompras",
];

const th = {
  padding: "9px 8px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: C.g500,
  textTransform: "uppercase",
  borderBottom: `2px solid ${C.g200}`,
  whiteSpace: "nowrap",
};

// ─── Facturas data table with expandable detail row ───
export default function FacturasTable({ data, role, onUpdate, totalCount }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const isCont = role === "contabilidad";
  const isCompras = role === "compras";

  return (
    <div style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: C.g100 }}>
              <th style={{ ...th, textAlign: "left", width: 30 }}></th>
              {mainCols.map((k) => {
                const f = ALL_FIELDS.find((x) => x.key === k);
                return (
                  <th key={k} style={{ ...th, textAlign: f?.numeric ? "right" : "left" }}>
                    {f?.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isExpanded = expandedRow === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    style={{ borderBottom: `1px solid ${C.g100}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.off)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.g500, padding: 0 }}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    </td>
                    {mainCols.map((k) => {
                      const f = ALL_FIELDS.find((x) => x.key === k);

                      if (k === "estado") {
                        return (
                          <td key={k} style={{ padding: "8px" }}>
                            <EditableCell
                              value={row.estado}
                              type="select"
                              options={ESTADOS}
                              canEdit={isCont}
                              onSave={(v) => onUpdate(row.id, "estado", v)}
                              renderValue={(v) => <Badge estado={v} />}
                            />
                          </td>
                        );
                      }

                      if (k === "observacion") {
                        return (
                          <td key={k} style={{ padding: "8px", maxWidth: 160, fontSize: 11 }}>
                            <EditableCell
                              value={row.observacion}
                              type="text"
                              canEdit={isCont}
                              onSave={(v) => onUpdate(row.id, "observacion", v)}
                              placeholder="Click para agregar"
                            />
                          </td>
                        );
                      }

                      if (k === "rtaCompras") {
                        return (
                          <td key={k} style={{ padding: "8px", maxWidth: 180, fontSize: 11 }}>
                            <EditableCell
                              value={row.rtaCompras}
                              type="text"
                              canEdit={isCompras}
                              onSave={(v) => onUpdate(row.id, "rtaCompras", v)}
                              placeholder="Click para responder"
                            />
                          </td>
                        );
                      }

                      if (f?.numeric) {
                        return (
                          <td
                            key={k}
                            style={{
                              padding: "8px",
                              textAlign: "right",
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: k === "total" ? C.navy : C.g700,
                              fontWeight: k === "total" ? 600 : 400,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fmt(row[k])}
                          </td>
                        );
                      }

                      const val = row[k] || "—";
                      return (
                        <td
                          key={k}
                          title={val}
                          style={{
                            padding: "8px",
                            color: k === "folio" ? C.navy : C.g700,
                            fontWeight: k === "folio" ? 600 : 400,
                            whiteSpace: "nowrap",
                            maxWidth: f?.w || 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontFamily: k === "nitEmisor" ? "monospace" : "inherit",
                            fontSize: 11,
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>

                  {isExpanded && (
                    <tr style={{ background: C.off }}>
                      <td colSpan={mainCols.length + 1} style={{ padding: "12px 20px 16px 44px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.accent, textTransform: "uppercase", marginBottom: 8 }}>
                          Detalle completo
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {ALL_FIELDS.map((f) => (
                            <div key={f.key} style={{ fontSize: 11 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: C.g500, textTransform: "uppercase" }}>
                                {f.label}:{" "}
                              </span>
                              <span style={{ color: C.g700, wordBreak: "break-all" }}>{f.numeric ? fmt(row[f.key]) : row[f.key] || "—"}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, color: C.g500, textTransform: "uppercase" }}>
                            CUFE Completo:{" "}
                          </span>
                          <span style={{ color: C.g700, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{row.cufe}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={mainCols.length + 1} style={{ padding: 48, textAlign: "center" }}>
                  <div className="empty-state">
                    <span className="empty-state-icon">🗂️</span>
                    <span style={{ color: C.g700, fontSize: 13, fontWeight: 600 }}>No se encontraron facturas</span>
                    <span style={{ color: C.g500, fontSize: 12 }}>Prueba con otros filtros o ajusta la búsqueda</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.g100}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.g500 }}>
        <span>
          Mostrando {data.length} de {totalCount} facturas
        </span>
        <span>{isCont ? "Click en estado u observación para editar · ▸ expande detalle" : "Click en Rta. Compras para responder · ▸ expande detalle"}</span>
      </div>
    </div>
  );
}
