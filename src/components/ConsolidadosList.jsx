import { useState } from "react";
import { C } from "../constants";
import { fmt } from "../utils";

const actionBtn = {
  background: C.white,
  border: `1px solid ${C.g200}`,
  fontSize: 11,
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: 4,
  cursor: "pointer",
  color: C.navy,
};

// "2026-09-25T14:03:00.000Z" -> "25-09-2026 14:03"
function fmtCreadoEn(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── List of archived monthly consolidados, with view/download/delete actions ───
export default function ConsolidadosList({ consolidados, onView, onDelete, onDownload, onBack }) {
  const [confirmId, setConfirmId] = useState(null);

  const sorted = [...consolidados].sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accentDark, textTransform: "uppercase", letterSpacing: 1 }}>
            Aclaración de facturas
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>Consolidados</h1>
        </div>
        <button style={actionBtn} onClick={onBack}>Volver</button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", color: C.g500, padding: "40px 0", fontSize: 14 }}>
          No hay consolidados guardados.
        </div>
      ) : (
        sorted.map((cons) => (
          <div
            key={cons.id}
            style={{
              background: C.white,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              padding: "16px 20px",
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{cons.nombre}</div>
              <div style={{ fontSize: 13, color: C.g500, marginTop: 2 }}>
                Desde {cons.fechaDesde} — Hasta {cons.fechaHasta}
              </div>
              <div style={{ fontSize: 13, color: C.g700, marginTop: 2 }}>
                {cons.cantidadFacturas} facturas · {fmt(cons.totalValor)}
              </div>
              <div style={{ fontSize: 11, color: C.g500, marginTop: 4 }}>
                Creado por {cons.creadoPor} el {fmtCreadoEn(cons.creadoEn)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...actionBtn, color: C.navy, borderColor: C.navy }} onClick={() => onView(cons.id)}>
                Ver
              </button>
              <button style={{ ...actionBtn, color: C.green, borderColor: C.green }} onClick={() => onDownload(cons.id)}>
                Descargar
              </button>
              {confirmId === cons.id ? (
                <span style={{ fontSize: 12, color: C.red, display: "flex", alignItems: "center", gap: 6 }}>
                  ¿Eliminar?
                  <button
                    style={{ ...actionBtn, padding: "4px 8px", color: C.red, borderColor: C.red }}
                    onClick={() => { onDelete(cons.id); setConfirmId(null); }}
                  >
                    Sí
                  </button>
                  <button style={{ ...actionBtn, padding: "4px 8px" }} onClick={() => setConfirmId(null)}>
                    No
                  </button>
                </span>
              ) : (
                <button style={{ ...actionBtn, color: C.red, borderColor: C.red }} onClick={() => setConfirmId(cons.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
