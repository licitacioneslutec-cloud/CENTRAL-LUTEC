import { useState, useEffect, useRef } from "react";
import { C } from "../constants";
import { useFilters } from "../hooks/useFilters";
import { useFacturas } from "../hooks/useFacturas";
import { exportToExcel } from "../utils";
import SearchBar from "./SearchBar";
import FilterChips from "./FilterChips";
import StatsBar from "./StatsBar";
import FacturasTable from "./FacturasTable";
import UploadExcel from "./UploadExcel";
import AddRowForm from "./AddRowForm";

// Short beep via the Web Audio API — no external sound file needed.
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

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

// ─── Facturas module: search/filters, stats and table for a given role ───
export default function FacturasModule({ user, role, onBack }) {
  const isCont = role === "contabilidad";
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const notifiedRef = useRef(false);

  const { data, loading, updateField, addFactura, bulkAdd, deleteFactura, deleteAll } = useFacturas();

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  // Handles the parsed Excel result — a flat array of rows now that
  // parseExcel no longer splits by sheet.
  const handleExcelUpload = (rows) => {
    const added = bulkAdd(rows);
    const duplicated = rows.length - added;
    showToast(`${added} facturas agregadas. ${duplicated} duplicadas omitidas.`);
  };

  const handleAddRow = (factura) => {
    const added = addFactura(factura);
    setShowAdd(false);
    showToast(added ? "Factura agregada correctamente." : "No se pudo agregar: CUFE vacío o ya existente.");
  };

  const handleBackup = () => {
    const today = new Date().toISOString().slice(0, 10);
    exportToExcel(data, `Respaldo_Facturas_${today}.xlsx`);
  };

  const handleDeleteAllConfirm = () => {
    if (deleteAllConfirm !== "BORRAR") return;
    deleteAll();
    setShowDeleteAll(false);
    setDeleteAllConfirm("");
    showToast("Todas las facturas fueron eliminadas.");
  };

  const handleDeleteRow = (id) => {
    deleteFactura(id);
    showToast("Factura eliminada.");
  };

  const pendingCount = loading ? 0 : isCont
    ? data.filter((r) => r.rtaCompras && r.rtaRevisada === false).length
    : data.filter((r) => r.rtaContabilidad && r.rtaContRevisada === false).length;

  useEffect(() => {
    if (loading || notifiedRef.current || pendingCount === 0) return;
    notifiedRef.current = true;
    playBeep();
  }, [loading, pendingCount]);

  const {
    filtered,
    search,
    setSearch,
    filtroEstado,
    setFiltroEstado,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    stats,
    filteredStats,
  } = useFilters(data);

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <header className="app-header" style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onBack}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}
            >
              ←
            </button>
            <div
              style={{
                width: 28,
                height: 28,
                border: `2px solid ${C.accent}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
            </div>
            <span className="brand-title" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
            <div
              style={{
                background: C.accent,
                color: C.navy,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "2px 8px",
                borderRadius: 3,
                textTransform: "uppercase",
              }}
            >
              {role}
            </div>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>
              👤 {user.name}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setBellOpen((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "4px 8px", position: "relative" }}
              title={pendingCount > 0 ? `${pendingCount} respuesta(s) pendiente(s)` : "Sin pendientes"}
            >
              🔔
              {pendingCount > 0 && (
                <span style={{
                  position: "absolute", top: 0, right: 2,
                  background: C.red, color: C.white, fontSize: 9, fontWeight: 700,
                  minWidth: 16, height: 16, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 3px",
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
            {bellOpen && (
              <div style={{
                position: "absolute", right: 0, top: 36,
                background: C.white, borderRadius: 6, padding: "12px 16px",
                boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 100, minWidth: 220,
              }}>
                {pendingCount > 0 ? (
                  <div style={{ fontSize: 12, color: C.g700 }}>
                    <strong style={{ color: C.navy }}>{pendingCount}</strong> respuesta{pendingCount === 1 ? "" : "s"} de{" "}
                    <strong>{isCont ? "compras" : "contabilidad"}</strong> pendiente{pendingCount === 1 ? "" : "s"} de revisar.
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.g500 }}>No hay respuestas pendientes.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Aclaración de facturas
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>Facturas</h1>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SearchBar search={search} setSearch={setSearch} />
            {isCont && (
              <>
                <button onClick={() => setShowAdd((v) => !v)} style={actionBtn}>
                  + Agregar
                </button>
                <UploadExcel onUpload={handleExcelUpload} />
                <button onClick={handleBackup} style={actionBtn}>
                  Descargar Respaldo
                </button>
                <button onClick={() => setShowDeleteAll(true)} style={{ ...actionBtn, color: C.red, borderColor: "#fecaca" }}>
                  Borrar Todo
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <FilterChips filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado} stats={stats} />
          <StatsBar stats={stats} filteredStats={filteredStats} role={role} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase", letterSpacing: 1 }}>F. Emisión:</span>
          <input type="date" style={dateInput} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <span style={{ fontSize: 11, color: C.g500 }}>a</span>
          <input type="date" style={dateInput} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
              }}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 11, cursor: "pointer" }}
            >
              Limpiar
            </button>
          )}
        </div>

        {isCont && showAdd && <AddRowForm onAdd={handleAddRow} onCancel={() => setShowAdd(false)} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>
            <div className="spinner" />
            Cargando facturas…
          </div>
        ) : (
          <FacturasTable
            data={filtered}
            allData={data}
            role={role}
            onUpdate={(id, key, value) => updateField(id, key, value, user.name)}
            onDelete={handleDeleteRow}
            totalCount={data.length}
            onWarn={showToast}
          />
        )}
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.navy,
            color: C.white,
            fontSize: 12,
            fontWeight: 600,
            padding: "10px 20px",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,.2)",
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}

      {showDeleteAll && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 360, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>Borrar todas las facturas</div>
            <div style={{ fontSize: 12, color: C.g700, marginBottom: 12 }}>
              Esta acción no se puede deshacer. Escriba <strong>BORRAR</strong> para confirmar.
            </div>
            <input
              value={deleteAllConfirm}
              onChange={(e) => setDeleteAllConfirm(e.target.value)}
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "7px 10px", border: `1px solid ${C.g200}`, borderRadius: 4, marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDeleteAllConfirm}
                disabled={deleteAllConfirm !== "BORRAR"}
                style={{
                  background: deleteAllConfirm === "BORRAR" ? C.red : C.g200,
                  color: C.white,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "7px 16px",
                  borderRadius: 4,
                  cursor: deleteAllConfirm === "BORRAR" ? "pointer" : "not-allowed",
                }}
              >
                Borrar Todo
              </button>
              <button
                onClick={() => {
                  setShowDeleteAll(false);
                  setDeleteAllConfirm("");
                }}
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
