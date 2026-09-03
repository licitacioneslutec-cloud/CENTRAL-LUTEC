import { useState, Fragment } from "react";
import { ALL_FIELDS, C, ESTADOS } from "../constants";
import { fmt, parseNum } from "../utils";
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
  "nERP",
  "valorContabilizado",
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

// canEdit for a column, given ALL_FIELDS metadata and the current role.
function canEditField(f, isCont, isCompras) {
  if (!f) return false;
  if (f.editable === "contabilidad") return isCont;
  if (f.editable === "compras") return isCompras;
  return false;
}

// ─── Facturas data table with expandable detail row ───
export default function FacturasTable({ data, allData, role, onUpdate, onDelete, totalCount, onWarn }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const isCont = role === "contabilidad";
  const isCompras = role === "compras";
  const rows = allData || data;

  const needsReview = (row) => Boolean(row.rtaCompras) && row.rtaRevisada === false;

  const handleDelete = (row) => {
    if (window.confirm(`¿Eliminar la factura folio ${row.folio || row.id}?`)) onDelete?.(row.id);
  };

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
              {isCont && <th style={{ ...th, width: 60 }}></th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isExpanded = expandedRow === row.id;
              const flagged = needsReview(row);
              return (
                <Fragment key={row.id}>
                  <tr
                    style={{
                      borderBottom: `1px solid ${C.g100}`,
                      borderLeft: flagged ? `3px solid ${C.green}` : "3px solid transparent",
                      background: flagged ? C.greenL : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!flagged) e.currentTarget.style.background = C.off;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = flagged ? C.greenL : "transparent";
                    }}
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
                      const canEdit = canEditField(f, isCont, isCompras);

                      if (k === "estado") {
                        return (
                          <td key={k} style={{ padding: "8px" }}>
                            <EditableCell
                              value={row.estado}
                              type="select"
                              options={ESTADOS}
                              canEdit={canEdit}
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
                              canEdit={canEdit}
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
                              canEdit={canEdit}
                              onSave={(v) => onUpdate(row.id, "rtaCompras", v)}
                              placeholder="Click para responder"
                            />
                          </td>
                        );
                      }

                      if (k === "nERP") {
                        const isDup = row.nERP && rows.some((r) => r.id !== row.id && r.nERP === row.nERP);
                        return (
                          <td key={k} style={{ padding: "8px", background: isDup ? C.redL : undefined }} title={isDup ? "N° ERP duplicado" : undefined}>
                            <EditableCell
                              value={row.nERP}
                              type="text"
                              canEdit={canEdit}
                              onSave={(v) => {
                                onUpdate(row.id, "nERP", v);
                                if (v && rows.some((r) => r.id !== row.id && r.nERP === v)) {
                                  onWarn?.(`N° ERP "${v}" ya existe en otra factura.`);
                                }
                              }}
                              placeholder="Click para agregar"
                            />
                          </td>
                        );
                      }

                      if (k === "valorContabilizado") {
                        const val = row.valorContabilizado;
                        const mismatch = Boolean(val) && val !== row.total;
                        const diff = mismatch ? val - (row.total || 0) : 0;
                        return (
                          <td
                            key={k}
                            style={{ padding: "8px", textAlign: "right", background: mismatch ? C.orangeL : undefined }}
                            title={mismatch ? `Difiere del total en ${fmt(diff)}` : undefined}
                          >
                            <EditableCell
                              value={val}
                              type="text"
                              canEdit={canEdit}
                              onSave={(v) => onUpdate(row.id, "valorContabilizado", parseNum(v))}
                              renderValue={(v) => (
                                <span style={{ fontFamily: "monospace", fontSize: 11, color: mismatch ? C.orange : C.g700 }}>{fmt(v)}</span>
                              )}
                              placeholder="Click para agregar"
                            />
                          </td>
                        );
                      }

                      if (f?.numeric) {
                        return (
                          <td key={k} style={{ padding: "8px", textAlign: "right" }}>
                            <EditableCell
                              value={row[k]}
                              type="text"
                              canEdit={canEdit}
                              onSave={(v) => onUpdate(row.id, k, parseNum(v))}
                              renderValue={(v) => (
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: 11,
                                    color: k === "total" ? C.navy : C.g700,
                                    fontWeight: k === "total" ? 600 : 400,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {fmt(v)}
                                </span>
                              )}
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={k}
                          style={{
                            padding: "8px",
                            whiteSpace: "nowrap",
                            maxWidth: f?.w || 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontFamily: k === "nitEmisor" ? "monospace" : "inherit",
                            fontSize: 11,
                          }}
                        >
                          <EditableCell
                            value={row[k]}
                            type="text"
                            canEdit={canEdit}
                            onSave={(v) => onUpdate(row.id, k, v)}
                            placeholder="Click para agregar"
                            renderValue={
                              canEdit
                                ? undefined
                                : (v) => (
                                    <span style={{ color: k === "folio" ? C.navy : C.g700, fontWeight: k === "folio" ? 600 : 400 }}>{v || "—"}</span>
                                  )
                            }
                          />
                        </td>
                      );
                    })}
                    {isCont && (
                      <td style={{ padding: "8px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {flagged && (
                          <button
                            onClick={() => onUpdate(row.id, "rtaRevisada", true)}
                            title="Marcar revisado"
                            style={{ background: C.green, color: C.white, border: "none", fontSize: 11, padding: "3px 6px", borderRadius: 3, cursor: "pointer", marginRight: 4 }}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(row)}
                          title="Eliminar factura"
                          style={{ background: "none", color: C.red, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "2px 6px" }}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>

                  {isExpanded && (
                    <tr style={{ background: C.off }}>
                      <td colSpan={mainCols.length + 1 + (isCont ? 1 : 0)} style={{ padding: "12px 20px 16px 44px" }}>
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
                <td colSpan={mainCols.length + 1 + (isCont ? 1 : 0)} style={{ padding: 48, textAlign: "center" }}>
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
        <span>{isCont ? "Click en cualquier celda para editar · ▸ expande detalle" : "Click en Rta. Compras para responder · ▸ expande detalle"}</span>
      </div>
    </div>
  );
}
