import { useState } from "react";
import { C, SAMPLE_NOVEDADES, SAMPLE_NO_RADICADAS } from "../constants";
import { useFilters } from "../hooks/useFilters";
import SearchBar from "./SearchBar";
import FilterChips from "./FilterChips";
import StatsBar from "./StatsBar";
import FacturasTable from "./FacturasTable";

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
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 8,
  marginLeft: 6,
};

// ─── Facturas module: tabs, search/filters, stats and table for a given role ───
export default function FacturasModule({ role, onBack }) {
  const isCont = role === "contabilidad";
  const [tab, setTab] = useState("novedades");
  const [novedades, setNovedades] = useState(SAMPLE_NOVEDADES);
  const [noRad, setNoRad] = useState(SAMPLE_NO_RADICADAS);

  const data = tab === "novedades" ? novedades : noRad;
  const setData = tab === "novedades" ? setNovedades : setNoRad;

  const { filtered, search, setSearch, filtroEstado, setFiltroEstado, stats } = useFilters(data);

  const handleUpdate = (id, key, value) => {
    setData((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <header style={{ background: C.navy, padding: "0 24px" }}>
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
            <span style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
            <div
              style={{
                background: C.accent,
                color: C.navy,
                fontSize: 9,
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
            Con novedades <span style={tabCount}>{novedades.length}</span>
          </button>
          <button style={tabBtn(tab === "noRadicadas")} onClick={() => setTab("noRadicadas")}>
            No radicadas <span style={tabCount}>{noRad.length}</span>
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 10, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Aclaración de facturas
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>
              {tab === "novedades" ? "Facturas con Novedades" : "Facturas No Radicadas"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SearchBar search={search} setSearch={setSearch} />
            {isCont && (
              <>
                <button
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
                <button
                  style={{
                    background: C.accent,
                    border: "none",
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "7px 14px",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Cargar Excel
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <FilterChips filtroEstado={filtroEstado} setFiltroEstado={setFiltroEstado} stats={stats} />
          <StatsBar stats={stats} />
        </div>

        <FacturasTable data={filtered} role={role} onUpdate={handleUpdate} totalCount={data.length} />
      </div>
    </div>
  );
}
