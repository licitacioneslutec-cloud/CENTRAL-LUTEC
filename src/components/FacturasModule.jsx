import { useState, useEffect, useRef, useCallback } from "react";
import { C, ESTADOS_COMPRAS_ALERTA } from "../constants";
import { useFilters } from "../hooks/useFilters";
import { useFacturas } from "../hooks/useFacturas";
import { exportToExcel, parseDateDMY } from "../utils";
import {
  isFirebaseConfigured,
  initFirebase,
  subscribePredefinedResponses,
  savePredefinedResponses,
  subscribeErpPrefixes,
  saveErpPrefixes,
  subscribeConsolidados,
  getConsolidado,
  deleteConsolidado,
  restoreFromConsolidado,
} from "../firebase";
import SearchBar from "./SearchBar";
import FilterChips from "./FilterChips";
import StatsBar from "./StatsBar";
import FacturasTable from "./FacturasTable";
import UploadExcel from "./UploadExcel";
import AddRowForm from "./AddRowForm";
import ConsolidadosList from "./ConsolidadosList";
import ConsolidadoDetail from "./ConsolidadoDetail";

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
  const configuredFb = isFirebaseConfigured();
  const configDbRef = useRef(null);

  const [predefinedResponses, setPredefinedResponses] = useState(null);
  const [erpPrefixes, setErpPrefixes] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [newOptionText, setNewOptionText] = useState({});

  const { data, loading, updateField, addFactura, bulkAdd, deleteFactura, deleteAll, consolidate } = useFacturas();

  // Consolidados state
  const [consView, setConsView] = useState(null); // null | "list" | "detail"
  const [consolidados, setConsolidados] = useState([]);
  const [consDetail, setConsDetail] = useState(null);
  const [showConsolidar, setShowConsolidar] = useState(false);
  const [consNombre, setConsNombre] = useState("");
  const [consDesde, setConsDesde] = useState("");
  const [consHasta, setConsHasta] = useState("");

  const canConfig = isCont || user.role === "admin";

  useEffect(() => {
    if (!configuredFb) return;
    if (!configDbRef.current) configDbRef.current = initFirebase();
    const unsub1 = subscribePredefinedResponses(configDbRef.current, (v) => setPredefinedResponses(v || {}));
    const unsub2 = subscribeErpPrefixes(configDbRef.current, (v) => setErpPrefixes(v || []));
    const unsub3 = subscribeConsolidados(configDbRef.current, setConsolidados);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [configuredFb]);

  const openConfig = () => {
    setConfigDraft({
      observacion: [...(predefinedResponses?.observacion || [])],
      rtaCompras: [...(predefinedResponses?.rtaCompras || [])],
      rtaContabilidad: [...(predefinedResponses?.rtaContabilidad || [])],
      erpPrefixes: [...(erpPrefixes || [])],
    });
    setNewOptionText({});
    setShowConfig(true);
  };

  const addConfigOption = (field) => {
    const text = (newOptionText[field] || "").trim();
    if (!text) return;
    setConfigDraft((prev) => ({ ...prev, [field]: [...prev[field], text] }));
    setNewOptionText((prev) => ({ ...prev, [field]: "" }));
  };

  const removeConfigOption = (field, idx) => {
    setConfigDraft((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));
  };

  const saveConfig = () => {
    const { erpPrefixes: prefixes, ...responses } = configDraft;
    if (configuredFb && configDbRef.current) {
      savePredefinedResponses(configDbRef.current, responses);
      saveErpPrefixes(configDbRef.current, prefixes);
    } else {
      setPredefinedResponses(responses);
      setErpPrefixes(prefixes);
    }
    setShowConfig(false);
    showToast("Configuración guardada.");
  };

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

  // Preview count for consolidation modal
  const consPreviewCount = (consDesde && consHasta) ? data.filter((r) => {
    const fe = parseDateDMY(r.fechaEmision);
    if (!fe) return false;
    return fe >= new Date(consDesde + "T00:00:00") && fe <= new Date(consHasta + "T23:59:59");
  }).length : 0;

  const handleConsolidar = () => {
    if (!consNombre.trim() || !consDesde || !consHasta) return;
    const count = consolidate(consNombre.trim(), consDesde, consHasta, user.name);
    setShowConsolidar(false);
    setConsNombre("");
    setConsDesde("");
    setConsHasta("");
    showToast(count > 0 ? `${count} facturas consolidadas en "${consNombre.trim()}".` : "No se encontraron facturas en ese rango.");
  };

  const handleConsView = useCallback(async (id) => {
    if (!configDbRef.current) return;
    const detail = await getConsolidado(configDbRef.current, id);
    if (detail) {
      setConsDetail(detail);
      setConsView("detail");
    }
  }, []);

  const handleConsDelete = useCallback(async (id) => {
    if (!configDbRef.current) return;
    await deleteConsolidado(configDbRef.current, id);
    showToast("Consolidado eliminado.");
  }, []);

  const handleConsDownload = useCallback(async (id) => {
    if (!configDbRef.current) return;
    const detail = await getConsolidado(configDbRef.current, id);
    if (!detail?.facturas) return;
    const rows = Object.values(detail.facturas);
    exportToExcel(rows, `Consolidado_${detail.nombre.replace(/\s+/g, "_")}.xlsx`);
  }, []);

  const handleConsRestore = useCallback(async (facturaEntries) => {
    if (!configDbRef.current || !consDetail) return;
    const remaining = Object.keys(consDetail.facturas).length - Object.keys(facturaEntries).length;
    await restoreFromConsolidado(configDbRef.current, consDetail.id, facturaEntries, remaining === 0);
    if (remaining === 0) {
      setConsView("list");
      setConsDetail(null);
      showToast("Todas las facturas restauradas. Consolidado eliminado.");
    } else {
      const updated = await getConsolidado(configDbRef.current, consDetail.id);
      setConsDetail(updated);
      showToast(`${Object.keys(facturaEntries).length} factura(s) restauradas al tablero.`);
    }
  }, [consDetail]);

  const handleConsRestoreAll = useCallback(async () => {
    if (!configDbRef.current || !consDetail?.facturas) return;
    await restoreFromConsolidado(configDbRef.current, consDetail.id, consDetail.facturas, true);
    setConsView("list");
    setConsDetail(null);
    showToast("Todas las facturas restauradas. Consolidado eliminado.");
  }, [consDetail]);

  const pendingCount = loading ? 0 : isCont
    ? data.filter((r) => (r.rtaCompras && r.rtaRevisada === false && (!r.estadoCompras || ESTADOS_COMPRAS_ALERTA.includes(r.estadoCompras))) || (ESTADOS_COMPRAS_ALERTA.includes(r.estadoCompras) && r.estadoComprasRevisado === false)).length
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
                    <strong style={{ color: C.navy }}>{pendingCount}</strong> alerta{pendingCount === 1 ? "" : "s"} de{" "}
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
        {consView === "list" ? (
          <ConsolidadosList
            consolidados={consolidados}
            onView={handleConsView}
            onDelete={handleConsDelete}
            onDownload={handleConsDownload}
            onBack={() => setConsView(null)}
          />
        ) : consView === "detail" && consDetail ? (
          <ConsolidadoDetail
            consolidado={consDetail}
            onBack={() => { setConsView("list"); setConsDetail(null); }}
            onRestore={handleConsRestore}
            onRestoreAll={handleConsRestoreAll}
            onDownload={() => {
              const rows = Object.values(consDetail.facturas || {});
              exportToExcel(rows, `Consolidado_${consDetail.nombre.replace(/\s+/g, "_")}.xlsx`);
            }}
          />
        ) : (
          <>
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
                  </>
                )}
                {user.role === "admin" && (
                  <>
                    <button onClick={() => setShowConsolidar(true)} style={{ ...actionBtn, color: C.accent, borderColor: C.accent }}>
                      Consolidar
                    </button>
                    <button onClick={() => setConsView("list")} style={actionBtn}>
                      Consolidados
                    </button>
                    <button onClick={() => setShowDeleteAll(true)} style={{ ...actionBtn, color: C.red, borderColor: "#fecaca" }}>
                      Borrar Todo
                    </button>
                  </>
                )}
                {canConfig && (
                  <button onClick={openConfig} style={actionBtn}>
                    ⚙ Respuestas
                  </button>
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
                onUpdate={(id, key, value) => updateField(id, key, value, user.name, role)}
                onDelete={handleDeleteRow}
                totalCount={data.length}
                onWarn={showToast}
                predefinedResponses={predefinedResponses}
                erpPrefixes={erpPrefixes}
              />
            )}
          </>
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

      {showConsolidar && (
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
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Consolidar facturas</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.g500, display: "block", marginBottom: 4 }}>Nombre del consolidado</label>
              <input
                value={consNombre}
                onChange={(e) => setConsNombre(e.target.value)}
                placeholder="Ej: Septiembre 2026"
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "7px 10px", border: `1px solid ${C.g200}`, borderRadius: 4 }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.g500, display: "block", marginBottom: 4 }}>Desde</label>
                <input type="date" value={consDesde} onChange={(e) => setConsDesde(e.target.value)} style={{ ...dateInput, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.g500, display: "block", marginBottom: 4 }}>Hasta</label>
                <input type="date" value={consHasta} onChange={(e) => setConsHasta(e.target.value)} style={{ ...dateInput, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            {consDesde && consHasta && (
              <div style={{ fontSize: 12, color: consPreviewCount > 0 ? C.navy : C.g500, fontWeight: 600, marginBottom: 14, padding: "8px 12px", background: C.off, borderRadius: 4 }}>
                {consPreviewCount > 0
                  ? `${consPreviewCount} factura(s) serán archivadas`
                  : "No hay facturas en este rango"}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleConsolidar}
                disabled={!consNombre.trim() || !consDesde || !consHasta || consPreviewCount === 0}
                style={{
                  background: consNombre.trim() && consDesde && consHasta && consPreviewCount > 0 ? C.accent : C.g200,
                  color: C.white,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "7px 16px",
                  borderRadius: 4,
                  cursor: consNombre.trim() && consDesde && consHasta && consPreviewCount > 0 ? "pointer" : "not-allowed",
                }}
              >
                Consolidar
              </button>
              <button
                onClick={() => {
                  setShowConsolidar(false);
                  setConsNombre("");
                  setConsDesde("");
                  setConsHasta("");
                }}
                style={{ background: C.g100, color: C.g700, border: "none", fontSize: 11, fontWeight: 600, padding: "7px 16px", borderRadius: 4, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
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

      {showConfig && configDraft && (
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
          <div style={{ background: C.white, borderRadius: 8, padding: 24, maxWidth: 480, width: "90%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Configurar respuestas y prefijos predefinidos</div>

            {[
              { key: "observacion", label: "Observación Contab." },
              { key: "rtaCompras", label: "Rta. Compras" },
              { key: "rtaContabilidad", label: "Rta. Contabilidad" },
              { key: "erpPrefixes", label: "Prefijos N° ERP" },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.g500, textTransform: "uppercase", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {configDraft[key].length === 0 && (
                    <span style={{ fontSize: 11, color: C.g300 }}>Sin opciones definidas</span>
                  )}
                  {configDraft[key].map((opt, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.off, borderRadius: 4, padding: "4px 8px" }}>
                      <span style={{ fontSize: 12, color: C.g700 }}>{opt}</span>
                      <button
                        onClick={() => removeConfigOption(key, idx)}
                        style={{ background: "none", color: C.red, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={newOptionText[key] || ""}
                    onChange={(e) => setNewOptionText((prev) => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addConfigOption(key); }}
                    placeholder="Nueva opción..."
                    style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4 }}
                  />
                  <button onClick={() => addConfigOption(key)} style={{ ...actionBtn, padding: "6px 10px" }}>
                    Agregar
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={saveConfig}
                style={{ background: C.accent, color: C.white, border: "none", fontSize: 11, fontWeight: 700, padding: "7px 16px", borderRadius: 4, cursor: "pointer" }}
              >
                Guardar
              </button>
              <button
                onClick={() => setShowConfig(false)}
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
