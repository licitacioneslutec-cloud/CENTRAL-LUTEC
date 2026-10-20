import { useState, useEffect, useMemo, useRef } from "react";
import { C } from "../constants";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { subscribeContratos, addComentario, setFechaCompromiso } from "../contratosFirebase";
import { fmt } from "../utils";
import SearchBar from "./SearchBar";

const SYNC_URL = "https://licitaciones3.app.n8n.cloud/webhook/contratos-sync";

const ALARMAS = {
  VENCIDO: { label: "VENCIDO", color: C.red, bg: C.redL },
  D15: { label: "15 DÍAS", color: "#c2410c", bg: "#fff7ed" },
  M3: { label: "3 MESES", color: "#a16207", bg: "#fefce8" },
  VIGENTE: { label: "VIGENTE", color: C.green, bg: C.greenL },
  SIN: { label: "SIN FECHA", color: C.g500, bg: C.g100 },
};
const CON_ALARMA = ["VENCIDO", "D15", "M3"];

const FILTROS = [
  ["ALARMA", "Con alarma"], ["TODOS", "Todos"], ["VENCIDO", "Vencidos"],
  ["D15", "≤15 días"], ["M3", "≤3 meses"], ["VIGENTE", "Vigentes"], ["SIN", "Sin fecha"],
];

// Remaining Monday fields shown in the expanded row. Third item true = peso amount.
const DETALLE = [
  ["estado2", "Estado 2"], ["fechaInicio", "Fecha inicio"],
  ["retegarantiaCobro", "Retegarantía cobro", true], ["retegarantiaAcum", "Retegarantía acum.", true],
  ["retePagada", "Rete pagada", true], ["liquidacionIng", "Liquidación Ing."],
  ["radicadoCont", "Radicado Cont."], ["pagoRete", "Pago rete"],
  ["iva", "IVA", true], ["anticipo", "Anticipo", true], ["estadoAnticipo", "Estado anticipo"],
  ["administracion", "Administración", true],
];

function diasPara(fechaFin) {
  if (!fechaFin) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(fechaFin + "T00:00:00");
  return isNaN(d) ? null : Math.round((d - hoy) / 86400000);
}

function alarmaDe(dias) {
  if (dias === null) return "SIN";
  if (dias < 0) return "VENCIDO";
  if (dias <= 15) return "D15";
  if (dias <= 90) return "M3";
  return "VIGENTE";
}

const pct = (v) => (v === undefined || v === null || v === "" ? "—" : Math.round(Number(v)) + "%");
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

const actionBtn = {
  background: C.white, border: `1px solid ${C.g200}`, fontSize: 11, fontWeight: 600,
  padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy,
};
const COLS = "110px minmax(160px,1fr) 110px 110px 110px 60px 110px 95px 60px 90px";

export default function ContratosModule({ user, role, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [raw, setRaw] = useState({ monday: null, notas: null });
  const [loading, setLoading] = useState(configured);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("ALARMA");
  const [collapsed, setCollapsed] = useState({});
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeContratos(dbRef.current, (d) => { setRaw(d); setLoading(false); });
  }, [configured]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const contratos = useMemo(() => {
    const { monday, notas } = raw;
    return Object.entries(monday || {})
      .filter(([k]) => k !== "_sync")
      .map(([id, c]) => {
        const dias = diasPara(c.fechaFin);
        return { ...c, id, dias, alarma: alarmaDe(dias), nota: (notas || {})[id] || {} };
      });
  }, [raw]);

  const counts = useMemo(() => {
    const n = { TODOS: contratos.length, ALARMA: 0, VENCIDO: 0, D15: 0, M3: 0, VIGENTE: 0, SIN: 0 };
    contratos.forEach((c) => { n[c.alarma]++; if (CON_ALARMA.includes(c.alarma)) n.ALARMA++; });
    return n;
  }, [contratos]);

  const grupos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const g = {};
    contratos
      .filter((c) => filtro === "TODOS" || (filtro === "ALARMA" ? CON_ALARMA.includes(c.alarma) : c.alarma === filtro))
      .filter((c) => !q || [c.nombre, c.nContrato, c.grupo].some((v) => String(v || "").toLowerCase().includes(q)))
      .forEach((c) => { (g[c.grupo || "Sin grupo"] ||= []).push(c); });
    return Object.entries(g)
      .map(([nombre, rows]) => ({ nombre, rows: rows.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity)) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [contratos, search, filtro]);

  const sync = raw.monday?._sync;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(SYNC_URL, { method: "POST" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      showToast("Sincronización iniciada; los datos se actualizan en 1–2 minutos");
    } catch (e) {
      showToast("No se pudo sincronizar: " + e.message);
    }
    setSyncing(false);
  };

  const comentar = (c) => {
    if (!draft.trim()) return;
    addComentario(dbRef.current, c.id, { texto: draft.trim(), autor: user.name, at: new Date().toISOString() });
    setDraft("");
  };

  const filterBtn = (key) => ({
    fontSize: 11, fontWeight: filtro === key ? 700 : 500, padding: "5px 12px", borderRadius: 4,
    cursor: "pointer", border: "none", transition: "all .1s",
    background: filtro === key ? C.navy : C.white, color: filtro === key ? C.white : C.g700,
    boxShadow: filtro === key ? "none" : `inset 0 0 0 1px ${C.g200}`,
  });

  const badge = (a) => (
    <span style={{ background: ALARMAS[a].bg, color: ALARMAS[a].color, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>
      {ALARMAS[a].label}
    </span>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <header className="app-header" style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
            </div>
            <span className="brand-title" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
            <div style={{ background: C.accent, color: C.navy, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>{role}</div>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>👤 {user.name}</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>Contratos Monday</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>Vencimientos de Contratos</h1>
            <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>Última sincronización: {fmtAt(sync?.at)}</div>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SearchBar search={search} setSearch={setSearch} placeholder="Buscar contrato, nombre, proyecto..." />
            <button onClick={handleSync} disabled={syncing}
              style={{ ...actionBtn, background: syncing ? C.g100 : C.accent, color: C.white, borderColor: C.accent }}>
              {syncing ? "Sincronizando…" : "⟳ Sincronizar Monday"}
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.g500, textTransform: "uppercase", marginRight: 4 }}>Filtrar:</span>
          {FILTROS.map(([k, l]) => (
            <button key={k} style={filterBtn(k)} onClick={() => setFiltro(k)}>{l} ({counts[k]})</button>
          ))}
        </div>

        {!configured ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>Firebase no está configurado: no hay contratos para mostrar.</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}><div className="spinner" />Cargando contratos…</div>
        ) : grupos.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>No hay contratos para este filtro.</div>
        ) : (
          grupos.map((g) => {
            const isCol = collapsed[g.nombre];
            const gc = {};
            g.rows.forEach((r) => { gc[r.alarma] = (gc[r.alarma] || 0) + 1; });
            return (
              <div key={g.nombre} style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 6, marginBottom: 12, overflowX: "auto" }}>
                <div onClick={() => setCollapsed((s) => ({ ...s, [g.nombre]: !s[g.nombre] }))}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: C.g100 }}>
                  <span style={{ fontSize: 11, color: C.g500 }}>{isCol ? "▶" : "▼"}</span>
                  <strong style={{ fontSize: 13, color: C.navy }}>{g.nombre}</strong>
                  <span style={{ fontSize: 11, color: C.g500 }}>{g.rows.length} contratos</span>
                  <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    {CON_ALARMA.filter((a) => gc[a]).map((a) => (
                      <span key={a} style={{ fontSize: 11, color: C.g700 }}>{gc[a]} {badge(a)}</span>
                    ))}
                  </span>
                </div>
                {!isCol && (
                  <div style={{ minWidth: 960 }}>
                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "6px 14px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.g200}` }}>
                      <span>N° Contrato</span><span>Nombre</span><span>Estado</span><span>Valor</span><span>Facturación</span><span>Avance</span><span>Saldo</span><span>Fecha fin</span><span>Días</span><span>Alarma</span>
                    </div>
                    {g.rows.map((c) => {
                      const isOpen = open === c.id;
                      return (
                        <div key={c.id} style={{ borderBottom: `1px solid ${C.g100}` }}>
                          <div onClick={() => { setOpen(isOpen ? null : c.id); setDraft(""); }}
                            style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 14px", fontSize: 12, color: C.g900, cursor: "pointer", alignItems: "center", background: isOpen ? C.blueL : "transparent" }}>
                            <span>{c.nContrato || "—"}</span>
                            <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                            <span>{c.estado || "—"}</span>
                            <span>{fmt(c.valor)}</span>
                            <span>{fmt(c.facturacion)}</span>
                            <span>{pct(c.avance)}</span>
                            <span>{fmt(c.saldo)}</span>
                            <span>{c.fechaFin || "—"}</span>
                            <span style={{ color: ALARMAS[c.alarma].color, fontWeight: 700 }}>{c.dias ?? "—"}</span>
                            <span>{badge(c.alarma)}</span>
                          </div>
                          {isOpen && (
                            <div style={{ padding: "12px 14px 16px", background: C.off, fontSize: 12 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10, marginBottom: 12 }}>
                                {DETALLE.map(([k, label, num]) => (
                                  <div key={k}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.g500, textTransform: "uppercase" }}>{label}</div>
                                    <div style={{ color: C.g900 }}>{c[k] === undefined || c[k] === "" ? "—" : num ? fmt(c[k]) : c[k]}</div>
                                  </div>
                                ))}
                              </div>
                              {c.mondayUrl && (
                                <a href={c.mondayUrl} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 11, fontWeight: 600 }}>Abrir en Monday ↗</a>
                              )}
                              <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase" }}>Fecha de compromiso:</span>
                                <input type="date" value={c.nota.fechaCompromiso || ""}
                                  onChange={(e) => setFechaCompromiso(dbRef.current, c.id, e.target.value)}
                                  style={{ fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none" }} />
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase", marginBottom: 6 }}>Comentarios</div>
                              {Object.values(c.nota.comentarios || {}).sort((a, b) => (a.at || "").localeCompare(b.at || "")).map((m, i) => (
                                <div key={i} style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 4, padding: "6px 10px", marginBottom: 6 }}>
                                  <div style={{ fontSize: 10, color: C.g500 }}>{m.autor} · {fmtAt(m.at)}</div>
                                  <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>
                                </div>
                              ))}
                              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Nuevo comentario..."
                                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "8px 10px", border: `1px solid ${C.g200}`, borderRadius: 4, resize: "vertical", marginBottom: 6 }} />
                              <button onClick={() => comentar(c)} disabled={!draft.trim()}
                                style={{ ...actionBtn, background: draft.trim() ? C.accent : C.g200, color: C.white, borderColor: "transparent", cursor: draft.trim() ? "pointer" : "not-allowed" }}>
                                Agregar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, fontSize: 12, fontWeight: 600, padding: "10px 20px", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.2)", zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
