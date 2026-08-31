import { useState } from "react";
import { C } from "../constants";
import { useFilters } from "../hooks/useFilters";
import { useFacturas } from "../hooks/useFacturas";
import SearchBar from "./SearchBar";
import FilterChips from "./FilterChips";
import StatsBar from "./StatsBar";
import FacturasTable from "./FacturasTable";
import UploadExcel from "./UploadExcel";
import AddRowForm from "./AddRowForm";

const tabBtn = (active) => ({
  padding: "10px 18px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  cursor: "pointer",
  border: "none",
  background: active ? C.white : "transparent",
  color: active ? C.navy : "rgba(255,255,255,.65)",
  borderBottom: active ? `3px solid ${C.accent}` : "3px solid transparent",
});

const tabCount = {
  background: "rgba(255,255,255,.15)",
  fontSize: 11,
  padding: "1px 6px",
  borderRadius: 8,
  marginLeft: 6,
};

// ─── Facturas module: tabs, search/filters, stats and table for a given role ───
export default function FacturasModule({ role, onBack }) {
  const isCont = role === "contabilidad";
  const [tab, setTab] = useState("novedades");
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const { data: novedadesData, loading: novLoading, updateField: updateNov, addFactura: addNov, bulkAdd: bulkAddNov } = useFacturas("novedades");
  const { data: noRadData, loading: noRadLoading, updateField: updateNoRad, addFactura: addNoRad, bulkAdd: bulkAddNoRad } = useFacturas("noRadicadas");

  const data = tab === "novedades" ? novedadesData : noRadData;
  const loading = tab === "novedades" ? novLoading : noRadLoading;
  const handleUpdate = tab === "novedades" ? updateNov : updateNoRad;
  const addFactura = tab === "novedades" ? addNov : addNoRad;

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  // Handles the parsed Excel result: bulk-inserts each sheet's rows into its
  // matching tab, skipping duplicates by CUFE (handled inside bulkAdd).
  const handleExcelUpload = ({ novedades, noRadicadas }) => {
    const addedNov = bulkAddNov(novedades);
    const addedNoRad = bulkAddNoRad(noRadicadas);
    const totalRows = novedades.length + noRadicadas.length;
    const totalAdded = addedNov + addedNoRad;
    const duplicated = totalRows - totalAdded;
    showToast(`${totalAdded} facturas agregadas. ${duplicated} duplicadas omitidas.`);
  };

  const handleAddRow = (factura) => {
    const added = addFactura(factura);
    setShowAdd(false);
    showToast(added ? "Factura agregada correctamente." : "No se pudo agregar: CUFE vacío o ya existente.");
  };

  const { filtered, search, setSearch, filtroEstado, setFiltroEstado, stats } = useFilters(data);

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
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <button style={tabBtn(tab === "novedades")} onClick={() => setTab("novedades")}>
            Con novedades <span style={tabCount}>{novedadesData.length}</span>
          </button>
          <button style={tabBtn(tab === "noRadicadas")} onClick={() => setTab("noRadicadas")}>
            No radicadas <span style={tabCount}>{noRadData.length}</span>
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Aclaración de facturas
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>
              {tab === "novedades" ? "Facturas con Novedades" : "Facturas No Radicadas"}
            </h1>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SearchBar search={search} setSearch={setSearch} />
            {isCont && (
              <>
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  style={{
                    background: C.white,
                    border: `1px solid ${C.g200}`,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "7px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    color: C.navy,
                  }}
                >
                  + Agregar
                </button>
                <UploadExcel onUpload={handleExcelUpload} />
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <FilterChips filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado} stats={stats} />
          <StatsBar stats={stats} role={role} />
        </div>

        {isCont && showAdd && <AddRowForm onAdd={handleAddRow} onCancel={() => setShowAdd(false)} />}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>
            <div className="spinner" />
            Cargando facturas…
          </div>
        ) : (
          <FacturasTable data={filtered} role={role} onUpdate={handleUpdate} totalCount={data.length} />
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
    </div>
  );
}
