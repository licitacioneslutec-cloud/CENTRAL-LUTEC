import { useState, Fragment } from "react";
import { C } from "../constants";
import { ALL_FIELDS_DOCS, ESTADOS_DOCS } from "../documentosConstants";
import { fmt } from "../utils";
import EditableCell from "./EditableCell";

const mainCols = [
  "nombreEmisor", "nitEmisor", "estado", "tipoDocumento", "numeroDocumento",
  "ordenCompra", "fechaEmision", "valorTotal",
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

function canEditField(f, role) {
  return f?.editable === role;
}

const estadoColor = (e) => {
  switch (e) {
    case "EN PROCESO": return { bg: C.blueL, color: C.blue };
    case "NOVEDAD": return { bg: C.orangeL, color: C.orange };
    case "RECHAZADO": return { bg: C.redL, color: C.red };
    case "SOLUCIONADO": return { bg: C.greenL, color: C.green };
    default: return { bg: C.g100, color: C.g500 };
  }
};

export default function DocumentosTable({ data, role, onUpdate, onReject }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);

  const toggleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedData = sortCol
    ? [...data].sort((a, b) => {
        const f = ALL_FIELDS_DOCS.find((x) => x.key === sortCol);
        const av = a[sortCol], bv = b[sortCol];
        let cmp;
        if (f?.numeric) cmp = (av || 0) - (bv || 0);
        else cmp = String(av || "").localeCompare(String(bv || ""), "es");
        return sortDir === "desc" ? -cmp : cmp;
      })
    : data;

  const renderCell = (row, col) => {
    const f = ALL_FIELDS_DOCS.find((x) => x.key === col);
    if (!f) return null;
    const editable = canEditField(f, role);

    if (col === "estado") {
      return (
        <EditableCell
          value={row.estado}
          type="select"
          options={ESTADOS_DOCS}
          canEdit={editable}
          onSave={(v) => onUpdate(row.id, "estado", v)}
          renderValue={(v) => {
            if (!v) return <span style={{ color: C.g300 }}>—</span>;
            const sc = estadoColor(v);
            return (
              <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3 }}>
                {v}
              </span>
            );
          }}
        />
      );
    }

    if (f.numeric) {
      return <span style={{ color: C.g700, fontFamily: "monospace" }}>{fmt(row[col])}</span>;
    }

    if (editable) {
      return (
        <EditableCell value={row[col]} type="text" canEdit onSave={(v) => onUpdate(row.id, col, v)} />
      );
    }

    const val = row[col];
    return val ? <span style={{ color: C.g700 }}>{val}</span> : <span style={{ color: C.g300 }}>—</span>;
  };

  if (data.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>
        No hay documentos para mostrar.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 6, border: `1px solid ${C.g200}`, background: C.white }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 32 }} />
            {mainCols.map((col) => {
              const f = ALL_FIELDS_DOCS.find((x) => x.key === col);
              if (!f) return null;
              return (
                <th key={col} style={{ ...th, width: f.w, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(col)}>
                  {f.label} {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              );
            })}
            <th style={{ ...th, width: 90 }}>Archivos</th>
            <th style={{ ...th, width: 90 }}>Soportes</th>
            <th style={{ ...th, width: 70 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const isExpanded = expandedRow === row.id;
            return (
              <Fragment key={row.id}>
                <tr style={{ borderBottom: `1px solid ${C.g100}`, background: isExpanded ? C.off : C.white }}>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.g500 }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  </td>
                  {mainCols.map((col) => (
                    <td key={col} style={{ padding: "6px 8px", maxWidth: ALL_FIELDS_DOCS.find((x) => x.key === col)?.w || 100 }}>
                      {renderCell(row, col)}
                    </td>
                  ))}
                  <td style={{ padding: "6px 8px" }}>
                    {(row.archivos || []).length > 0 ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {row.archivos.map((a, i) => (
                          <a
                            key={i}
                            href={a.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 10, color: C.blue, textDecoration: "none", background: C.blueL, padding: "1px 5px", borderRadius: 3 }}
                            title={a.nombre}
                          >
                            {a.nombre.endsWith(".xml") ? "XML" : a.nombre.endsWith(".pdf") ? "PDF" : a.nombre}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: C.g300, fontSize: 10 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {(row.soportes || []).length > 0 ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {row.soportes.map((s, i) => (
                          <a
                            key={i}
                            href={s.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 10, color: C.green, textDecoration: "none", background: C.greenL, padding: "1px 5px", borderRadius: 3 }}
                            title={s.nombre}
                          >
                            {s.nombre}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: C.g300, fontSize: 10 }}>Sin soporte</span>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {row.estado !== "RECHAZADO" && row.estado !== "SOLUCIONADO" && (
                      <button
                        onClick={() => onReject(row)}
                        style={{
                          background: C.redL, color: C.red, border: `1px solid ${C.red}20`,
                          fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 3, cursor: "pointer",
                        }}
                      >
                        Rechazar
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={mainCols.length + 4} style={{ padding: "12px 24px", background: C.off, borderBottom: `1px solid ${C.g200}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px 24px", fontSize: 12 }}>
                        <div><strong style={{ color: C.g500 }}>Email:</strong> <span style={{ color: C.g700 }}>{row.emailRemitente || "—"}</span></div>
                        <div><strong style={{ color: C.g500 }}>F. Recepción:</strong> <span style={{ color: C.g700 }}>{row.fechaRecepcion || "—"}</span></div>
                        <div><strong style={{ color: C.g500 }}>IVA:</strong> <span style={{ color: C.g700 }}>{fmt(row.iva)}</span></div>
                        <div><strong style={{ color: C.g500 }}>Divisa:</strong> <span style={{ color: C.g700 }}>{row.divisa || "COP"}</span></div>
                        <div><strong style={{ color: C.g500 }}># RP:</strong> {renderCell(row, "rp")}</div>
                        <div><strong style={{ color: C.g500 }}>Centro Costos:</strong> {renderCell(row, "centroCostos")}</div>
                        <div><strong style={{ color: C.g500 }}>Departamento:</strong> {renderCell(row, "departamento")}</div>
                        <div><strong style={{ color: C.g500 }}>XML:</strong> <span style={{ color: row.tieneXML ? C.green : C.red }}>{row.tieneXML ? "Sí" : "No"}</span></div>
                        <div><strong style={{ color: C.g500 }}>PDF:</strong> <span style={{ color: row.tienePDF ? C.green : C.red }}>{row.tienePDF ? "Sí" : "No"}</span></div>
                        {row.motivoRechazo && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <strong style={{ color: C.red }}>Motivo Rechazo:</strong>{" "}
                            <span style={{ color: C.g700 }}>{row.motivoRechazo}</span>
                            {row.decidePor && <span style={{ color: C.g500 }}> — por {row.decidePor}</span>}
                            {row.fechaDecision && <span style={{ color: C.g500 }}> ({row.fechaDecision})</span>}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
