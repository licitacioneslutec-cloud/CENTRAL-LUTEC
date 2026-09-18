import { useState } from "react";
import { C } from "../constants";
import { ESTADOS_DOCS } from "../documentosConstants";
import { useDocumentos } from "../hooks/useDocumentos";
import { useDocumentosFilters } from "../hooks/useDocumentosFilters";
import { fmt } from "../utils";
import SearchBar from "./SearchBar";
import DocumentosTable from "./DocumentosTable";

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

const dateInput = {
  fontSize: 12,
  padding: "6px 8px",
  border: `1px solid ${C.g200}`,
  borderRadius: 4,
  outline: "none",
};

export default function DocumentosModule({ user, role, onBack }) {
  const [toast, setToast] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [syncing, setSyncing] = useState(false);

  const { data, loading, updateField } = useDocumentos();
  const {
    filtered, search, setSearch,
    filtroEstado, setFiltroEstado,
    fechaDesde, setFechaDesde,
    fechaHasta, setFechaHasta,
    stats, filteredStats,
  } = useDocumentosFilters(data);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      showToast("Datos actualizados. Los correos se sincronizan automáticamente.");
    }, 1000);
  };

  const handleReject = (row) => {
    setRejectTarget(row);
    setMotivoRechazo("");
  };

  const submitReject = async () => {
    if (!rejectTarget || !motivoRechazo.trim()) return;
    const row = rejectTarget;
    setRejectTarget(null);
    try {
      const res = await fetch("https://licitaciones3.app.n8n.cloud/webhook/docs-proveedor-rechazar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebaseId: row.id,
          nombreEmisor: row.nombreEmisor,
          nitEmisor: row.nitEmisor,
          tipoDocumento: row.tipoDocumento,
          numeroDocumento: row.numeroDocumento,
          emailRemitente: row.emailRemitente,
          motivoRechazo: motivoRechazo.trim(),
          decidePor: user.name,
        }),
      });
      if (!res.ok) throw new Error("Error en webhook");
      showToast("Rechazo enviado por email a " + (row.emailRemitente || "proveedor"));
    } catch (e) {
      updateField(row.id, "estado", "RECHAZADO", user.name);
      updateField(row.id, "motivoRechazo", motivoRechazo.trim(), user.name);
      updateField(row.id, "decidePor", user.name, user.name);
      updateField(row.id, "fechaDecision", new Date().toLocaleDateString("es-CO"), user.name);
      showToast("Rechazo guardado (email no enviado: " + e.message + ")");
    }
  };

  const filterBtn = (key) => ({
    fontSize: 11,
    fontWeight: filtroEstado === key ? 700 : 500,
    padding: "5px 12px",
    borderRadius: 4,
    cursor: "pointer",
    border: "none",
    transition: "all .1s",
    background: filtroEstado === key ? C.navy : C.white,
    color: filtroEstado === key ? C.white : C.g700,
    boxShadow: filtroEstado === key ? "none" : `inset 0 0 0 1px ${C.g200}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <header className="app-header" style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>
              ←
            </button>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
            </div>
            <span className="brand-title" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
            <div style={{ background: C.accent, color: C.navy, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>
              {role}
            </div>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>
              👤 {user.name}
            </span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Documentos Proveedor
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>Gestión de Documentos</h1>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SearchBar search={search} setSearch={setSearch} />
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{ ...actionBtn, background: syncing ? C.g100 : C.accent, color: C.white, borderColor: C.accent }}
            >
              {syncing ? "Sincronizando…" : "⟳ Sincronizar Correos"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div className="filter-chips" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.g500, textTransform: "uppercase", marginRight: 4 }}>
              Filtrar:
            </span>
            <button style={filterBtn("TODOS")} onClick={() => setFiltroEstado("TODOS")}>Todos ({stats.total})</button>
            <button style={filterBtn("EN PROCESO")} onClick={() => setFiltroEstado("EN PROCESO")}>En Proceso ({stats.enProceso})</button>
            <button style={filterBtn("NOVEDAD")} onClick={() => setFiltroEstado("NOVEDAD")}>Novedad ({stats.novedad})</button>
            <button style={filterBtn("RECHAZADO")} onClick={() => setFiltroEstado("RECHAZADO")}>Rechazado ({stats.rechazado})</button>
            <button style={filterBtn("SOLUCIONADO")} onClick={() => setFiltroEstado("SOLUCIONADO")}>Solucionado ({stats.solucionado})</button>
            <button style={filterBtn("SIN ESTADO")} onClick={() => setFiltroEstado("SIN ESTADO")}>Sin estado ({stats.sinEstado})</button>
          </div>
          <div style={{ fontSize: 11, color: C.g500 }}>
            Total: <strong style={{ color: C.navy }}>{fmt(filteredStats.totalVal)}</strong>
            {filteredStats.count < stats.total && <span> ({filteredStats.count} de {stats.total})</span>}
            {" · "}IVA: <strong style={{ color: C.navy }}>{fmt(filteredStats.totalIva)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase", letterSpacing: 1 }}>F. Recepción:</span>
          <input type="date" style={dateInput} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <span style={{ fontSize: 11, color: C.g500 }}>a</span>
          <input type="date" style={dateInput} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 11, cursor: "pointer" }}
            >
              Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>
            <div className="spinner" />
            Cargando documentos…
          </div>
        ) : (
          <DocumentosTable
            data={filtered}
            role={role}
            onUpdate={(id, key, value) => updateField(id, key, value, user.name)}
            onReject={handleReject}
          />
        )}
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.navy, color: C.white, fontSize: 12, fontWeight: 600,
          padding: "10px 20px", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.2)", zIndex: 1000,
        }}>
          {toast}
        </div>
      )}

      {rejectTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 420, width: "90%", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>Rechazar Documento</div>
            <div style={{ fontSize: 12, color: C.g700, marginBottom: 4 }}>
              <strong>{rejectTarget.nombreEmisor}</strong> — {rejectTarget.tipoDocumento}{rejectTarget.numeroDocumento}
            </div>
            <div style={{ fontSize: 11, color: C.g500, marginBottom: 12 }}>
              Se enviará un correo de rechazo al proveedor ({rejectTarget.emailRemitente}) con un link para subir soporte.
            </div>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo..."
              autoFocus
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", fontSize: 12,
                padding: "8px 10px", border: `1px solid ${C.g200}`, borderRadius: 4,
                marginBottom: 14, resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={submitReject}
                disabled={!motivoRechazo.trim()}
                style={{
                  background: motivoRechazo.trim() ? C.red : C.g200,
                  color: C.white, border: "none", fontSize: 11, fontWeight: 700,
                  padding: "7px 16px", borderRadius: 4,
                  cursor: motivoRechazo.trim() ? "pointer" : "not-allowed",
                }}
              >
                Rechazar y Enviar Correo
              </button>
              <button
                onClick={() => setRejectTarget(null)}
                style={{ background: C.g100, color: C.g700, border: "none", fontSize: 11, fontWeight: 600, padding: "7px 16px", borderRadius: 4, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
