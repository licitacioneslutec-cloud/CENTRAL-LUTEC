import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { fmt, corto, fmtF } from "../utils";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { MODO_PRUEBA } from "../contratosFirebase";
import { subscribeResumenes, leerCorte, guardarCorte } from "../carteraFirebase";
import { leerCartera, fechaDeNombre, resumenCorte, compararCortes, libroComparacion, RANGOS, rango } from "../carteraExcel";
import SearchBar from "./SearchBar";
import { Cascada, BarrasV, Linea, BarrasH, Kpi, Panel } from "./CarteraCharts";
import CruceBanco from "./CruceBanco";

const MAX_MB = 20;
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");
const actionBtn = { background: C.white, borderStyle: "solid", borderWidth: 1, borderColor: C.g200, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const MONEY = ["valor", "antes", "despues", "delta"];
const FLT0 = { cli: "", rango: "", doc: "", ven: "", venc: false };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const TABS = [["todas", "Todas"], ["nuevas", "Nuevas"], ["salieron", "Salieron"], ["cambioValor", "Cambios de valor"], ["cambioRango", "Cambios de rango"]];

// filtros compartidos (tabla y gráfica); la gráfica no aplica flt.cli: clic en una barra lo activa
const pasa = (f, q, flt, conCli) => (!q || [f.cli, f.nit, f.num].some((v) => String(v).toLowerCase().includes(q))) && (!conCli || !flt.cli || f.cli === flt.cli) && (!flt.rango || rango(f.dias) === flt.rango) && (!flt.doc || f.doc === flt.doc) && (!flt.ven || f.ven === flt.ven) && (!flt.venc || f.dias > 0);

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
  const [qCli, setQCli] = useState(""), [orden, setOrden] = useState("mayor"), [mostrar, setMostrar] = useState("10"); // controles de la gráfica de clientes
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
  const datosCli = useMemo(() => {
    const q = search.trim().toLowerCase(), qc = qCli.trim().toLowerCase(), o = {};
    for (const f of todasL) if (pasa(f, q, flt, false) && (!qc || f.cli.toLowerCase().includes(qc))) o[f.cli] = (o[f.cli] || 0) + f.valor;
    const l = Object.entries(o).map(([cli, valor]) => ({ cli, valor })).sort((x, y) => (orden === "mayor" ? y.valor - x.valor : x.valor - y.valor));
    return { n: l.length, graf: mostrar === "todos" ? l : l.slice(0, Number(mostrar)) };
  }, [todasL, search, qCli, orden, mostrar, flt]);
  const filas = useMemo(() => {
    const q = search.trim().toLowerCase(), sk = ord.col === "rango" ? "dias" : ord.col;
    return base.filter((f) => pasa(f, q, flt, true))
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
      const fNombre = fechaDeNombre(file.name); // manda sobre la fecha del título
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
      <style>{"@media print { .no-print { display: none !important; } body { background: #fff; } .cli-scroll { max-height: none !important; overflow: visible !important; } }"}</style>
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
              <Panel titulo={`Clientes por saldo${cargado ? ` (${datosCli.n})` : ""}`}>
                {!cargado ? <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Cargando corte…</div> : (
                  <>
                    <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                      {[[mostrar, setMostrar, [["10", "Top 10"], ["20", "Top 20"], ["todos", "Todos"]]], [orden, setOrden, [["mayor", "Mayor saldo"], ["menor", "Menor saldo"]]]].map(([v, set, ops], i) => (
                        <select key={i} value={v} onChange={(e) => set(e.target.value)} style={{ ...actionBtn, fontWeight: 400 }}>{ops.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                      ))}
                      <select value={flt.rango} onChange={(e) => setFlt({ ...flt, rango: e.target.value })} style={{ ...actionBtn, fontWeight: 400 }}>
                        <option value="">Todos los rangos</option>
                        {RANGOS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <label style={{ fontSize: 12, color: C.g700, display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flt.venc} onChange={(e) => setFlt({ ...flt, venc: e.target.checked })} />Solo vencidas</label>
                      <input value={qCli} onChange={(e) => setQCli(e.target.value)} placeholder="Buscar cliente…" style={{ ...actionBtn, fontWeight: 400, width: 130 }} />
                      {flt.cli && <button onClick={() => setFlt({ ...flt, cli: "" })} style={actionBtn} title={flt.cli}>✕ {flt.cli.length > 22 ? flt.cli.slice(0, 21) + "…" : flt.cli}</button>}
                    </div>
                    <div style={{ fontSize: 11, color: C.g500, marginBottom: 4 }}>{datosCli.graf.length} de {datosCli.n} clientes · suma graficada: <b style={{ color: C.navy }}>{fmt(datosCli.graf.reduce((s, d) => s + d.valor, 0))}</b> · clic en una barra filtra la tabla</div>
                    <div className="cli-scroll" style={mostrar === "todos" ? { maxHeight: 420, overflowY: "auto" } : undefined}>
                      {datosCli.graf.length ? <BarrasH datos={datosCli.graf} sel={flt.cli} onClick={(cli) => setFlt((o) => ({ ...o, cli: o.cli === cli ? "" : cli }))} /> : <div style={{ fontSize: 12, color: C.g500, padding: "20px 0", textAlign: "center" }}>Sin clientes con esos filtros.</div>}
                    </div>
                  </>
                )}
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
