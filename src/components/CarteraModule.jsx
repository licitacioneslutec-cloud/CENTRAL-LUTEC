import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { fmt } from "../utils";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { MODO_PRUEBA } from "../contratosFirebase";
import { subscribeResumenes, leerCorte, guardarCorte } from "../carteraFirebase";
import { leerCartera, resumenCorte, compararCortes, libroComparacion, RANGOS, rango } from "../carteraExcel";
import SearchBar from "./SearchBar";
import CruceBanco from "./CruceBanco";

const MAX_MB = 20;
const corto = (n) => (Math.abs(n) >= 1e6 ? `${n < 0 ? "-" : ""}$${Math.abs(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 0 })} M` : fmt(n));
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");
const fmtF = (f) => (f ? f.split("-").reverse().join("/") : "—");
const actionBtn = { background: C.white, borderStyle: "solid", borderWidth: 1, borderColor: C.g200, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };
const MONEY = ["valor", "antes", "despues", "delta"];
const FLT0 = { cli: "", rango: "", doc: "", ven: "", venc: false };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const TABS = [["todas", "Todas"], ["nuevas", "Nuevas"], ["salieron", "Salieron"], ["cambioValor", "Cambios de valor"], ["cambioRango", "Cambios de rango"]];

// ─── Gráficos SVG (sin librerías) ───
const W = 560, H = 240, M = { l: 12, r: 12, t: 20, b: 30 };
const Svg = ({ children }) => <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>{children}</svg>;
const escala = (lo, hi, a, b) => (v) => a + ((v - lo) / (hi - lo || 1)) * (b - a);

// items: [{label, valor, base?, color}]; barra de base→base+valor (o 0→valor si no hay base)
function Cascada({ cas }) {
  const { saldoAnt, nuevas, salieron, ajustes, saldoAct } = cas;
  const it = [
    { label: "Saldo anterior", de: 0, a: saldoAnt, color: C.navy, txt: corto(saldoAnt) },
    { label: "Nuevas", de: saldoAnt, a: saldoAnt + nuevas, color: C.red, txt: "+" + corto(nuevas) },
    { label: "Salieron", de: saldoAnt + nuevas, a: saldoAnt + nuevas - salieron, color: C.green, txt: "−" + corto(salieron) },
    { label: "Ajustes", de: saldoAnt + nuevas - salieron, a: saldoAct, color: C.orange, txt: (ajustes < 0 ? "−" : "+") + corto(Math.abs(ajustes)) },
    { label: "Saldo actual", de: 0, a: saldoAct, color: C.navy, txt: corto(saldoAct) },
  ];
  // Eje truncado: las variaciones diarias son diminutas frente al saldo
  const niv = it.flatMap((x) => [x.de ? x.de : null, x.a].filter((v) => v !== null));
  const mn = Math.min(...niv), mx = Math.max(...niv), sp = (mx - mn) || Math.abs(mx) || 1;
  const lo = mn - sp * 0.6, hi = mx + sp * 0.25, y = escala(lo, hi, H - M.b, M.t);
  const bw = (W - M.l - M.r) / it.length;
  return (
    <Svg>
      {it.map((x, i) => {
        const y1 = y(x.de || lo), y2 = y(x.a), top = Math.min(y1, y2), h = Math.max(Math.abs(y1 - y2), 2);
        return (
          <g key={x.label}>
            <rect x={M.l + i * bw + bw * 0.15} y={top} width={bw * 0.7} height={h} fill={x.color} rx={2} />
            <text x={M.l + i * bw + bw / 2} y={top - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.g900}>{x.txt}</text>
            <text x={M.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={C.g500}>{x.label}</text>
          </g>
        );
      })}
    </Svg>
  );
}

function BarrasV({ datos }) {
  const mx = Math.max(0, ...datos.map((d) => d.valor)), mn = Math.min(0, ...datos.map((d) => d.valor));
  const y = escala(mn, mx, H - M.b, M.t + 8), bw = (W - M.l - M.r) / datos.length;
  return (
    <Svg>
      <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke={C.g300} />
      {datos.map((d, i) => {
        const y1 = y(0), y2 = y(d.valor);
        return (
          <g key={d.label}>
            <rect x={M.l + i * bw + bw * 0.15} y={Math.min(y1, y2)} width={bw * 0.7} height={Math.max(Math.abs(y1 - y2), 1)} fill={i === 0 ? C.blue : i < 3 ? C.orange : C.red} rx={2} />
            <text x={M.l + i * bw + bw / 2} y={Math.min(y1, y2) - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.g900}>{corto(d.valor)}</text>
            <text x={M.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={C.g500}>{d.label}</text>
          </g>
        );
      })}
    </Svg>
  );
}

function Linea({ puntos }) {
  if (puntos.length < 2) return <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Se necesitan al menos 2 cortes para ver la evolución.</div>;
  const mx = Math.max(...puntos.flatMap((q) => [q.total, q.vencido])), mn = Math.min(0, ...puntos.map((q) => q.vencido));
  const y = escala(mn, mx, H - M.b, M.t + 10), x = (i) => M.l + 30 + (i / (puntos.length - 1)) * (W - M.l - M.r - 60);
  const tr = (k) => puntos.map((q, i) => `${x(i)},${y(q[k])}`).join(" ");
  const ult = puntos.length - 1;
  return (
    <Svg>
      {[["total", C.navy], ["vencido", C.red]].map(([k, col]) => (
        <g key={k}>
          <polyline points={tr(k)} fill="none" stroke={col} strokeWidth={2} />
          {puntos.map((q, i) => <circle key={q.fecha} cx={x(i)} cy={y(q[k])} r={3} fill={col}><title>{`${fmtF(q.fecha)}: ${fmt(q[k])}`}</title></circle>)}
          <text x={x(ult)} y={y(puntos[ult][k]) - 8} textAnchor="end" fontSize={11} fontWeight={700} fill={col}>{k === "total" ? "Total " : "Vencido "}{corto(puntos[ult][k])}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 10} textAnchor="start" fontSize={11} fill={C.g500}>{fmtF(puntos[0].fecha)}</text>
      <text x={x(ult)} y={H - 10} textAnchor="end" fontSize={11} fill={C.g500}>{fmtF(puntos[ult].fecha)}</text>
    </Svg>
  );
}

function BarrasH({ datos }) {
  const mx = Math.max(1, ...datos.map((d) => d.valor)), fila = 22, h = datos.length * fila + 8, tx = 190;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {datos.map((d, i) => (
        <g key={d.cli}>
          <text x={tx - 6} y={i * fila + 16} textAnchor="end" fontSize={11} fill={C.g700}>{d.cli.length > 30 ? d.cli.slice(0, 29) + "…" : d.cli}<title>{d.cli}</title></text>
          <rect x={tx} y={i * fila + 5} width={Math.max((d.valor / mx) * (W - tx - 80), 1)} height={14} fill={C.blue} rx={2} />
          <text x={tx + Math.max((d.valor / mx) * (W - tx - 80), 1) + 5} y={i * fila + 16} fontSize={11} fontWeight={700} fill={C.g900}>{corto(d.valor)}</text>
        </g>
      ))}
    </svg>
  );
}

const Kpi = ({ label, valor, sub, color = C.navy }) => (
  <div style={{ ...card, flex: "1 1 160px" }}>
    <div style={{ fontSize: 10, color: C.g500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
    {sub && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>{sub}</div>}
  </div>
);
const Panel = ({ titulo, children }) => (
  <div style={{ ...card, flex: "1 1 420px", minWidth: 0 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{titulo}</div>
    {children}
  </div>
);

export default function CarteraModule({ user, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const fileRef = useRef(null);
  const [res, setRes] = useState({});
  const [loading, setLoading] = useState(configured);
  const [sel, setSel] = useState(null);
  const [data, setData] = useState({ sel: null, prev: null, act: null, ant: null });
  const [tab, setTab] = useState("todas");
  const [vista, setVista] = useState("cortes"); // cortes | banco
  const [flt, setFlt] = useState(FLT0);
  const [ord, setOrd] = useState({ col: "dias", dir: "desc" });
  const toggleSort = (col) => setOrd((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  const [search, setSearch] = useState("");
  const [conf, setConf] = useState(null); // { corte, archivo, existe }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeResumenes(dbRef.current, (v) => { setRes(v); setLoading(false); });
  }, [configured]);

  const fechas = useMemo(() => Object.keys(res).sort(), [res]);
  const fecha = sel && res[sel] ? sel : fechas[fechas.length - 1] || null; // por defecto el último
  const prev = fecha ? fechas[fechas.indexOf(fecha) - 1] || null : null;

  useEffect(() => {
    if (!fecha) return;
    let vivo = true;
    Promise.all([leerCorte(dbRef.current, fecha), prev ? leerCorte(dbRef.current, prev) : null])
      .then(([act, ant]) => vivo && setData({ sel: fecha, prev, act, ant }))
      .catch((e) => vivo && showToast("No se pudo leer el corte: " + (e.message || e)));
    return () => { vivo = false; };
  }, [fecha, prev]);

  const cargado = data.sel === fecha && data.prev === prev && !!data.act;
  const comp = useMemo(() => (cargado ? compararCortes(data.ant, data.act) : null), [cargado, data]);
  const r = fecha ? res[fecha] : null, rp = prev ? res[prev] : null;

  const todasL = useMemo(() => (cargado ? Object.entries(data.act).map(([k, f]) => ({ ...f, k })) : []), [cargado, data]);
  const base = useMemo(() => (tab === "todas" ? todasL : comp?.[tab] || []), [tab, todasL, comp]);
  const opc = useMemo(() => { const o = (key) => [...new Set(todasL.map((f) => f[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")); return { cli: o("cli"), ven: o("ven"), doc: o("doc") }; }, [todasL]);
  const filas = useMemo(() => {
    const q = search.trim().toLowerCase(), sk = ord.col === "rango" ? "dias" : ord.col;
    return base.filter((f) => (!q || [f.cli, f.nit, f.num].some((v) => String(v).toLowerCase().includes(q))) && (!flt.cli || f.cli === flt.cli) && (!flt.rango || rango(f.dias) === flt.rango) && (!flt.doc || f.doc === flt.doc) && (!flt.ven || f.ven === flt.ven) && (!flt.venc || f.dias > 0))
      .sort((a, b) => { const x = a[sk], y = b[sk], c = typeof x === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "es"); return ord.dir === "desc" ? -c : c; });
  }, [base, search, flt, ord]);
  const totalTab = filas.reduce((s, f) => s + (tab === "cambioValor" ? f.delta : f.valor), 0);
  const totVenc = filas.filter((f) => f.dias > 0).reduce((s, f) => s + f.valor, 0);
  const COLS = tab === "todas"
    ? [["Cliente", "cli"], ["NIT", "nit"], ["Sucursal", "suc"], ["Vendedor", "ven"], ["Doc", "doc"], ["Número", "num"], ["Fecha", "fecha"], ["Vence", "vence"], ["Días", "dias", 1], ["Rango", "rango"], ["Valor", "valor", 1]]
    : [["Cliente", "cli"], ["NIT", "nit"], ["Doc", "doc"], ["Número", "num"], ["Fecha", "fecha"], ["Vence", "vence"], ["Días", "dias", 1],
      ...(tab === "cambioValor" ? [["Antes", "antes", 1], ["Después", "despues", 1], ["Diferencia", "delta", 1]] : tab === "cambioRango" ? [["De", "de"], ["A", "a"], ["Valor", "valor", 1]] : [["Valor", "valor", 1]])];
  const cel = (f, k) => (k === "rango" ? rango(f.dias) : k === "fecha" || k === "vence" ? fmtF(f[k]) : MONEY.includes(k) ? fmt(f[k]) : f[k]);
  const hayFlt = Object.keys(FLT0).some((k) => flt[k] !== FLT0[k]);

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1048576) { showToast(`"${file.name}" pesa más de ${MAX_MB} MB y no se leyó.`); return; }
    setBusy(true);
    try {
      const corte = leerCartera(XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }));
      // World Office pone en el título la fecha en que se generó el informe; si el nombre trae "DD MM YYYY", manda esa
      const m = file.name.match(/(\d{1,2})[ ._-](\d{1,2})[ ._-](\d{4})/);
      const fNombre = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
      setConf({ corte, archivo: file.name, fNombre, fecha: fNombre || corte.fechaCorte });
    } catch (err) { showToast(err.message || String(err)); }
    setBusy(false);
  };

  const confirmar = async () => {
    const { corte, archivo, fecha: f } = conf;
    setBusy(true);
    try {
      await guardarCorte(dbRef.current, f, { at: new Date().toISOString(), autor: user.name, archivo, facturas: corte.facturas }, resumenCorte(corte.facturas));
      setSel(f);
      setConf(null);
      showToast(`Corte del ${fmtF(f)} guardado`);
    } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };

  const exportar = () => XLSX.writeFile(libroComparacion(XLSX, { fecha, fechaAnt: prev, resumen: r, comp, todas: todasL, filtro: filas.map((f) => (tab === "cambioValor" ? { ...f, valor: f.delta } : f)) }), `Cartera_${fecha}.xlsx`);

  const th = { textAlign: "left", fontSize: 10, color: C.g500, textTransform: "uppercase", padding: "6px 8px", borderBottom: `1px solid ${C.g200}`, whiteSpace: "nowrap" };
  const td = { fontSize: 12, padding: "6px 8px", borderBottom: `1px solid ${C.g100}` };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const vari = rp ? r.total - rp.total : 0;
  const pctV = r?.total ? (r.vencido / r.total) * 100 : 0;
  const pctVAnt = rp?.total ? (rp.vencido / rp.total) * 100 : null;

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif", paddingTop: MODO_PRUEBA ? 24 : 0 }}>
      <style>{"@media print { .no-print { display: none !important; } body { background: #fff; } }"}</style>
      {MODO_PRUEBA && <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 24, lineHeight: "24px", background: "#facc15", color: "#422006", fontSize: 12, fontWeight: 700, textAlign: "center", zIndex: 1300 }}>MODO PRUEBA — los cambios no afectan producción</div>}
      <header className="app-header no-print" style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", height: 50, gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
          <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
          </div>
          <span className="brand-title" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
          <div style={{ background: C.accent, color: C.navy, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>{user.role}</div>
          <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>👤 {user.name}</span>
        </div>
      </header>

      <div style={{ padding: "20px clamp(16px, 2vw, 24px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>Cartera</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>{vista === "banco" ? "Cruce con banco" : `Estado de Cuenta 30-60-90${fecha ? ` · corte ${fmtF(fecha)}` : ""}`}</h1>
            {r && vista === "cortes" && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>Cargado: {fmtAt(r.at)} · {r.autor || "—"} · {r.archivo || "—"} · {prev ? `comparado con ${fmtF(prev)}` : "Sin corte anterior"}</div>}
          </div>
          <div className="no-print" style={{ display: "flex", gap: 6 }}>
            {[["cortes", "Cortes"], ["banco", "Cruce con banco"]].map(([k, n]) => <button key={k} onClick={() => setVista(k)} style={{ ...actionBtn, ...(vista === k ? { background: C.navy, color: C.white, borderColor: C.navy } : {}) }}>{n}</button>)}
          </div>
          {vista === "cortes" && <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {fechas.length > 0 && (
              <select value={fecha || ""} onChange={(e) => setSel(e.target.value)} style={{ ...actionBtn, fontWeight: 400 }}>
                {[...fechas].reverse().map((f) => <option key={f} value={f}>{fmtF(f)}</option>)}
              </select>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onArchivo} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy || !configured} style={{ ...actionBtn, background: busy ? C.g100 : C.accent, color: C.white, borderColor: C.accent }}>{busy ? "Procesando…" : "⬆ Subir corte"}</button>
            <button onClick={exportar} disabled={!comp} style={actionBtn}>⬇ Exportar Excel</button>
            <button onClick={() => window.print()} disabled={!comp} style={actionBtn}>🖨 Imprimir</button>
          </div>}
        </div>

        {!configured ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Firebase no está configurado: el módulo Cartera necesita la base de datos.</div>
        ) : loading ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Cargando…</div>
        ) : vista === "banco" ? (
          <CruceBanco db={initFirebase()} user={user} fechas={fechas} showToast={showToast} />
        ) : !r ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Aún no hay cortes: use "Subir corte" con el Estado de Cuenta 30-60-90 de World Office.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Kpi label="Saldo total" valor={corto(r.total)} sub={fmt(r.total)} />
              <Kpi label="Vencido" valor={corto(r.vencido)} sub={fmt(r.vencido)} color={C.red} />
              <Kpi label="% vencido" valor={pctV.toFixed(1) + "%"} sub={pctVAnt === null ? "Sin corte anterior" : `antes ${pctVAnt.toFixed(1)}%`} />
              <Kpi label="N.º documentos" valor={r.nDocs} sub={rp ? `${r.nDocs - rp.nDocs >= 0 ? "+" : ""}${r.nDocs - rp.nDocs} vs anterior` : "Sin corte anterior"} />
              <Kpi label="Variación vs anterior" valor={rp ? (vari >= 0 ? "+" : "−") + corto(Math.abs(vari)) : "—"} sub={rp ? fmt(vari) : "Sin corte anterior"} color={vari > 0 ? C.red : C.green} />
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Panel titulo="Movimiento del saldo">
                {comp ? <Cascada cas={comp.cascada} /> : <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Cargando corte…</div>}
                {!prev && <div style={{ fontSize: 11, color: C.g500, textAlign: "center" }}>Sin corte anterior</div>}
              </Panel>
              <Panel titulo="Saldo por rango de edad (días de vencimiento)">
                <BarrasV datos={RANGOS.map((g) => ({ label: g, valor: r.porRango?.[g] || 0 }))} />
              </Panel>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <Panel titulo="Evolución del saldo total y vencido">
                <Linea puntos={fechas.map((f) => ({ fecha: f, total: res[f].total, vencido: res[f].vencido }))} />
              </Panel>
              <Panel titulo="Top 10 clientes por saldo">
                <BarrasH datos={r.topClientes || []} />
              </Panel>
            </div>

            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TABS.map(([k, n]) => (
                    <button key={k} onClick={() => setTab(k)} style={{ ...actionBtn, ...(tab === k ? { background: C.navy, color: C.white, borderColor: C.navy } : {}) }}>{n}{comp ? ` (${(k === "todas" ? todasL : comp[k]).length})` : ""}</button>
                  ))}
                </div>
                <div className="no-print"><SearchBar search={search} setSearch={setSearch} placeholder="Buscar cliente, NIT, número..." /></div>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {[["cli", "Todos los clientes", opc.cli], ["rango", "Todos los rangos", RANGOS], ["doc", "Todos los doc", opc.doc], ["ven", "Todos los vendedores", opc.ven]].map(([k, n, ops]) => (
                  <select key={k} value={flt[k]} onChange={(e) => setFlt({ ...flt, [k]: e.target.value })} style={{ ...actionBtn, fontWeight: 400, maxWidth: 220 }}>
                    <option value="">{n}</option>
                    {ops.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                <label style={{ fontSize: 12, color: C.g700, display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flt.venc} onChange={(e) => setFlt({ ...flt, venc: e.target.checked })} />Solo vencidas</label>
                {hayFlt && <button onClick={() => setFlt(FLT0)} style={actionBtn}>Limpiar</button>}
              </div>
              {tab !== "todas" && !prev ? (
                <div style={{ fontSize: 12, color: C.g500, padding: 16, textAlign: "center" }}>Sin corte anterior: suba otro corte para ver cambios.</div>
              ) : !comp ? (
                <div style={{ fontSize: 12, color: C.g500, padding: 16, textAlign: "center" }}>Cargando…</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>{filas.length} registros · {tab === "cambioValor" ? "diferencia" : "total"}: <b style={{ color: C.navy }}>{fmt(totalTab)}</b>{tab === "todas" && <> · vencido: <b style={{ color: C.red }}>{fmt(totVenc)}</b> · por vencer: <b style={{ color: C.navy }}>{fmt(totalTab - totVenc)}</b></>}</div>
                  <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {COLS.map(([h, k, right]) => <th key={k} onClick={() => toggleSort(k)} style={{ ...th, ...(right ? { textAlign: "right" } : {}), cursor: "pointer", userSelect: "none" }}>{h} {ord.col === k ? (ord.dir === "asc" ? "▲" : "▼") : ""}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.slice(0, 500).map((f) => (
                          <tr key={f.k}>{COLS.map(([, k, right]) => <td key={k} style={right ? tdN : td}>{cel(f, k)}</td>)}</tr>
                        ))}
                        {!filas.length && <tr><td colSpan={COLS.length} style={{ ...td, textAlign: "center", color: C.g500 }}>Sin registros.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {filas.length > 500 && <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>Mostrando 500 de {filas.length}; use filtros o exporte el Excel (trae todos).</div>}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {conf && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>Subir corte</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
              Archivo: <b>{conf.archivo}</b><br />
              Fecha de corte: <input type="date" value={conf.fecha} onChange={(e) => setConf({ ...conf, fecha: e.target.value })} style={{ fontSize: 13, padding: "2px 6px", border: `1px solid ${C.g200}`, borderRadius: 4 }} /><br />
              <span style={{ fontSize: 11, color: C.g500 }}>
                Título del archivo: {fmtF(conf.corte.fechaCorte)}{conf.fNombre ? ` · nombre del archivo: ${fmtF(conf.fNombre)}` : ""}
              </span><br />
              Documentos: <b>{Object.keys(conf.corte.facturas).length}</b><br />
              Saldo total: <b>{fmt(conf.corte.total)}</b>
            </div>
            {conf.corte.totalGeneral !== null && Math.abs(conf.corte.total - conf.corte.totalGeneral) > 1 && (
              <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 10 }}>
                La suma de los documentos ({fmt(conf.corte.total)}) difiere del "Total general" del archivo ({fmt(conf.corte.totalGeneral)}).
              </div>
            )}
            {conf.fNombre && conf.fNombre !== conf.corte.fechaCorte && (
              <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 10 }}>
                El nombre del archivo ({fmtF(conf.fNombre)}) y el título ({fmtF(conf.corte.fechaCorte)}) no coinciden. Verifique la fecha de corte antes de confirmar.
              </div>
            )}
            {!!res[conf.fecha] && (
              <div style={{ background: C.redL, border: `1px solid ${C.red}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 10 }}>
                Ya existe un corte de esa fecha, se reemplazará.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConf(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={confirmar} disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(conf.fecha || "")} style={{ ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent }}>{busy ? "Guardando…" : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, fontSize: 12, fontWeight: 600, padding: "10px 20px", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.2)", zIndex: 1200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
