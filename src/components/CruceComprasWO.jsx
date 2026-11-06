import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { fmt, corto, fmtF } from "../utils";
import { isFirebaseConfigured, initFirebase, subscribeFacturas } from "../firebase";
import { MODO_PRUEBA } from "../contratosFirebase";
import { subscribeRuta, leerMesWO, guardarMesWO, eliminarMesWO, guardarRevisionWO } from "../carteraFirebase";
import { leerComprasWO, cruzar, resumenCruce, libroCruceWO, aplicarExclusiones, paresDe, firmaDe, estadoRev, normDoc, REV, CATS, CAT } from "../cruceWO";
import SearchBar from "./SearchBar";
import { BarrasV, BarrasH, Kpi, Panel } from "./CarteraCharts";

const MAX_MB = 20;
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };
const VACIO = [], OBJ = {};
const REV_COLOR = { pendiente: [C.g200, C.g700], aprobado: [C.greenL, C.green], observado: [C.orangeL, C.orange], cambio: [C.redL, C.red] };
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");
const actionBtn = { background: C.white, borderStyle: "solid", borderWidth: 1, borderColor: C.g200, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const primario = { ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const FLT0 = { cat: "", prov: "", obs: "", rev: "" };
const SIN_OBS = "__sin";
const TABS = [["todas", "Todas"], ...CATS.map(([k, n]) => [k, n]), ["aprobados", "Aprobados"], ["eliminadas", "Eliminadas"]];
const MONEY = ["valorPortal", "valorWO", "dif"];
const mesLbl = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const campo = (f, k, rv) => (k === "categoria" ? CAT[f.categoria]?.n : k === "rev" ? rv(f) : f[k]);

// Panel de una fila: lado portal vs WO, emparejar / separar y revisión. onGuardar(fila, parche): el parche se guarda en el registro de esa fila.
function EditorFila({ f, rec, est, filas, onGuardar, onClose, onEliminar, disabled }) {
  const [nota, setNota] = useState(rec?.nota || ""), [q, setQ] = useState("");
  const esW = f.categoria === "soloWO", mismo = (x) => (x.nit === f.nit ? 0 : 1);
  const opts = filas.filter((x) => (esW ? x.id != null && (x.categoria === "noWO" || x.categoria === "sinERP") : x.categoria === "soloWO") && (!q || [x.num, x.proveedor, x.nit].some((v) => String(v ?? "").toLowerCase().includes(q.trim().toLowerCase())))).sort((a, b) => mismo(a) - mismo(b)).slice(0, 200);
  const go = (g, parche) => { if (g) { onGuardar(g, parche); onClose(); } };
  const lado = { flex: "1 1 220px", fontSize: 12, lineHeight: 1.7, color: C.g700 };
  const sugF = esW && f.sugId != null ? filas.find((x) => x.id === f.sugId) : null;
  const b = (txt, fn, st = actionBtn) => <button key={txt} onClick={fn} disabled={disabled} style={st}>{txt}</button>;
  return (
    <div style={{ background: C.off, border: `1px solid ${C.g200}`, borderRadius: 6, padding: 12, margin: "4px 0" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={lado}><b style={{ color: C.navy }}>Portal (factura DIAN)</b><br />{esW ? "—" : <>N.º ERP: <b>{f.num || "—"}</b>{f.tipoDoc ? ` · ${f.tipoDoc}` : ""}<br />{f.proveedor} · NIT {f.nit || "—"}<br />Valor: <b>{fmt(f.valorPortal ?? 0)}</b> · emisión {fmtF(f.fecha)}<br />Observación: {f.obs || "—"}</>}</div>
        <div style={lado}><b style={{ color: C.navy }}>World Office</b><br />{f.valorWO == null ? "—" : <>Documento: <b>{f.doc}</b>{f.manual ? " (emparejada a mano)" : ""}<br />{esW ? <>{f.proveedor} · NIT {f.nit || "—"}<br /></> : null}Valor: <b>{fmt(f.valorWO)}</b>{f.dif != null && <><br />Diferencia: <b style={{ color: C.red }}>{fmt(f.dif)}</b></>}</>}</div>
      </div>
      {f.sugerencia && <div style={{ fontSize: 12, color: C.g700, marginTop: 6 }}>Sugerencia: {f.sugerencia}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={esW ? "Buscar factura del portal…" : "Buscar documento de WO…"} style={{ fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4, width: 190 }} />
        <select value="" disabled={disabled} onChange={(e) => e.target.value && go(esW ? opts.find((x) => x.key === e.target.value) : f, { par: esW ? f.doc : e.target.value })} style={{ ...actionBtn, fontWeight: 400, maxWidth: 300 }}>
          <option value="">Emparejar con… ({opts.length})</option>
          {opts.map((x) => <option key={x.key} value={esW ? x.key : x.doc}>{x.nit === f.nit ? "★ " : ""}{(esW ? x.num || "sin N.º ERP" : x.doc)} · {String(x.proveedor).slice(0, 24)} · {fmt(esW ? x.valorPortal : x.valorWO)}</option>)}
        </select>
        {!esW && f.sugDoc && b(`Aplicar sugerencia (${f.sugDoc})`, () => go(f, { par: f.sugDoc }), primario)}
        {sugF && b(`Aplicar sugerencia (${sugF.num || "sin N.º ERP"})`, () => go(sugF, { par: f.doc }), primario)}
        {!esW && f.doc && !f.manual && b("Separar", () => go(f, { par: "" }))}
        {f.manual && b("Quitar emparejamiento manual", () => go(f, { par: null }))}
        {!esW && rec?.par === "" && b("Quitar separación", () => go(f, { par: null }))}
      </div>
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional; se guarda con Aprobar / Observación / Pendiente)" rows={2} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, fontSize: 12, padding: 6, border: `1px solid ${C.g200}`, borderRadius: 4, fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        {b("Aprobar", () => go(f, { estado: "aprobado", nota }), primario)}
        {b("Marcar con observación", () => go(f, { estado: "observado", nota }))}
        {b("Volver a pendiente", () => go(f, { estado: null, nota }))}
        <button onClick={onClose} style={actionBtn}>Cerrar</button>
        {b("🗑 Eliminar del cruce", () => onEliminar([f]), { ...actionBtn, color: C.red })}
        <span style={{ fontSize: 11, color: est === "cambio" ? C.red : C.g500 }}>{est === "cambio" ? "Cambió desde la revisión (valores o pareja distintos). " : ""}{rec?.at ? `Último cambio: ${rec.autor || "—"} · ${fmtAt(rec.at)}` : ""}</span>
      </div>
    </div>
  );
}

export default function CruceComprasWO({ user, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [res, setRes] = useState({}), [revD, setRevD] = useState({ mes: null, v: OBJ }), [facRaw, setFacRaw] = useState(null); // facRaw null = cargando
  const [marc, setSel] = useState(new Set()), [abierta, setAbierta] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [selM, setSelM] = useState(null), [data, setData] = useState({ mes: null, act: null }), [recarga, setRecarga] = useState(0);
  const [tab, setTab] = useState("todas"), [flt, setFlt] = useState(FLT0), [search, setSearch] = useState("");
  const [ord, setOrd] = useState({ col: "num", dir: "asc" });
  const toggleSort = (col) => setOrd((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  const [nuevo, setNuevo] = useState(null), [conf, setConf] = useState(null); // nuevo: archivo elegido; conf: lectura lista para confirmar
  const [busy, setBusy] = useState(false), [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    const u = [subscribeRuta(dbRef.current, "cruceWO/resumen", (v) => { setRes(v); setLoading(false); }), subscribeFacturas(dbRef.current, (v) => setFacRaw(v || {}))];
    return () => u.forEach((f) => f());
  }, [configured]);

  const meses = useMemo(() => Object.keys(res).sort(), [res]);
  const mes = selM && res[selM] ? selM : meses[meses.length - 1] || null; // por defecto el último
  useEffect(() => {
    if (!mes) return;
    let vivo = true;
    leerMesWO(dbRef.current, mes).then((act) => vivo && setData({ mes, act })).catch((e) => vivo && showToast("No se pudo leer el mes: " + (e.message || e)));
    const u = subscribeRuta(dbRef.current, `cruceWO/revision/${mes}`, (v) => setRevD({ mes, v }));
    return () => { vivo = false; u(); };
  }, [mes, recarga]);

  const cargado = data.mes === mes && !!data.act, listo = cargado && !!facRaw;
  const revN = revD.mes === mes ? revD.v : OBJ;
  const docs = useMemo(() => (cargado ? Object.values(data.act.docs || {}) : VACIO), [cargado, data]);
  const facturas = useMemo(() => (facRaw ? Object.entries(facRaw).map(([id, v]) => ({ ...v, id })) : null), [facRaw]);
  const filas = useMemo(() => (listo ? cruzar(facturas, docs, mes, paresDe(revN)) : VACIO), [listo, facturas, docs, mes, revN]);
  const { activas, excluidas } = useMemo(() => aplicarExclusiones(filas, revN), [filas, revN]);
  const rs = useMemo(() => (listo ? resumenCruce(activas, docs) : null), [listo, activas, docs]);
  const rvOf = (f) => estadoRev(f, revN[f.key]);
  const nRev = { aprobado: 0, observado: 0, cambio: 0, pendiente: 0 };
  for (const f of activas) nRev[rvOf(f)]++;
  const r0 = mes ? res[mes] : null, pc = (k) => rs?.porCat[k];
  const lista = useMemo(() => ({ todas: activas, ...Object.fromEntries(CATS.map(([k]) => [k, activas.filter((f) => f.categoria === k)])), aprobados: activas.filter((f) => estadoRev(f, revN[f.key]) === "aprobado"), eliminadas: excluidas }), [activas, excluidas, revN]);
  const elim = tab === "eliminadas";
  const base = lista[tab] ?? VACIO;
  const obsOpts = useMemo(() => [...new Set(base.map((f) => f.obs).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [base]);

  const vista = useMemo(() => {
    const q = search.trim().toLowerCase(), pv = flt.prov.trim().toLowerCase(), numerica = MONEY.includes(ord.col);
    return base.filter((f) => (!q || [f.num, f.doc, f.proveedor, f.nit, f.obs, f.sugerencia, CAT[f.categoria]?.n].some((v) => String(v ?? "").toLowerCase().includes(q))) && (!flt.cat || f.categoria === flt.cat) && (!pv || `${f.proveedor} ${f.nit}`.toLowerCase().includes(pv)) && (!flt.obs || (flt.obs === SIN_OBS ? !f.obs : f.obs === flt.obs)) && (!flt.rev || rvOf(f) === flt.rev))
      .sort((a, b) => { const x = campo(a, ord.col, rvOf), y = campo(b, ord.col, rvOf), c = numerica ? (x ?? 0) - (y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""), "es", { numeric: true }); return ord.dir === "desc" ? -c : c; });
  }, [base, search, flt, ord, revN]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (k) => vista.reduce((s, f) => s + (f[k] ?? 0), 0);
  const COLS = [["Categoría", "categoria"], ["N.º ERP / Doc WO", "num"], ["Proveedor", "proveedor"], ["NIT", "nit"], ["Fecha", "fecha"], ["Observación", "obs"], ...(elim ? [["Motivo", "motivo"], ["Eliminada por", "exAutor"]] : [["Revisión", "rev"]]), ["Valor portal", "valorPortal", 1], ["Valor WO", "valorWO", 1], ["Diferencia", "dif", 1], ["Sugerencia", "sugerencia"]];
  const cel = (f, k) => {
    if (k === "categoria") return <span style={{ background: `#${CAT[f.categoria]?.c || "D9D9D9"}`, color: C.g900, borderRadius: 3, padding: "1px 6px", fontSize: 11, whiteSpace: "nowrap" }}>{CAT[f.categoria]?.n || f.categoria}</span>;
    if (k === "rev") { const e = rvOf(f), [bg, fg] = REV_COLOR[e]; return <span title={e === "cambio" ? "Cambió desde la revisión" : undefined} style={{ background: bg, color: fg, borderRadius: 3, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{REV[e]}</span>; }
    if (k === "num") return <>{f.num || "—"}{f.doc && f.doc !== normDoc(f.num) && f.id != null && <span title="Emparejada a mano con un documento de WO de otro número" style={{ color: C.blue }}> ↔ {f.doc} (manual)</span>}</>;
    if (k === "fecha") return fmtF(f.fecha);
    if (k === "exAutor") return `${f.exAutor || "—"} · ${fmtAt(f.exAt)}`;
    if (MONEY.includes(k)) return f[k] == null ? "—" : fmt(f[k]);
    return f[k] ?? "";
  };
  const hayFlt = Object.keys(FLT0).some((k) => flt[k] !== FLT0[k]);
  const topProv = useMemo(() => { // valor sin cruzar limpio por proveedor (todo lo que no es OK)
    const m = {};
    for (const f of activas) if (f.categoria !== "ok") m[f.proveedor || f.nit || "—"] = (m[f.proveedor || f.nit || "—"] || 0) + Math.abs((f.categoria === "soloWO" ? f.valorWO : f.categoria === "dif" ? f.dif : f.valorPortal) ?? 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cli, valor]) => ({ cli, valor }));
  }, [activas]);

  // ─── Subir reporte ───
  const procesar = async () => {
    setBusy(true);
    try {
      if (nuevo.size > MAX_MB * 1048576) throw new Error(`"${nuevo.name}" pesa más de ${MAX_MB} MB y no se leyó.`);
      const wo = leerComprasWO(XLSX.read(await nuevo.arrayBuffer(), { type: "array", cellDates: true }));
      setConf({ wo, archivo: nuevo.name, mes: wo.mes }); setNuevo(null);
    } catch (err) { showToast(err.message || String(err)); }
    setBusy(false);
  };
  const existe = !!(conf && res[conf.mes]);
  const confirmar = async () => {
    setBusy(true);
    try {
      const { wo, archivo, mes: m, deCero } = conf;
      await guardarMesWO(dbRef.current, m, { at: new Date().toISOString(), autor: user.name, archivo, desde: wo.desde, hasta: wo.hasta, docs: wo.docs }, { n: wo.docs.length, total: wo.total }, existe && deCero);
      setSelM(m); setRecarga((n) => n + 1);
      showToast(`Reporte de ${mesLbl(m)} guardado`);
      setConf(null);
    } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };
  const [excl, setExcl] = useState(null), [motivoE, setMotivoE] = useState(""); // filas por eliminar del cruce
  const [borrar, setBorrar] = useState(null); // { mes, conRevision }
  const eliminar = async () => {
    setBusy(true);
    try {
      await eliminarMesWO(dbRef.current, borrar.mes, borrar.conRevision);
      showToast(`Reporte de ${mesLbl(borrar.mes)} eliminado`);
      setSelM(null); setFlt(FLT0); setSel(new Set()); setAbierta(null); setBorrar(null);
    } catch (err) { showToast("No se pudo eliminar: " + (err.message || err)); }
    setBusy(false);
  };

  // Revisión: items = [[fila, parche]]; null en el parche borra el campo. Un solo update.
  const guardarRev = async (items) => {
    const at = new Date().toISOString(), cambios = {};
    for (const [f, parche] of items) {
      const k = f.key, x = { ...(k in cambios ? cambios[k] : revN[k]), ...parche, autor: user.name, at };
      if ("estado" in parche) x.firma = parche.estado ? firmaDe(f) : null;
      for (const c of Object.keys(x)) if (x[c] == null || (c === "nota" && !x[c])) delete x[c];
      cambios[k] = x.par !== undefined || x.estado || x.nota || x.excluido ? x : null;
    }
    setBusy(true);
    try { await guardarRevisionWO(dbRef.current, mes, cambios); setSel(new Set()); } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };

  const exportar = () => XLSX.writeFile(libroCruceWO(XLSX, { filas: activas, facturasPorId: facRaw || {}, revision: (f) => { const rc = revN[f.key]; return [REV[rvOf(f)], rc?.nota || "", rc?.autor || ""]; } }), `CruceWO_${mes}.xlsx`);

  const th = { textAlign: "left", fontSize: 10, color: C.g500, textTransform: "uppercase", padding: "6px 8px", borderBottom: `1px solid ${C.g200}`, whiteSpace: "nowrap" };
  const td = { fontSize: 12, padding: "6px 8px", borderBottom: `1px solid ${C.g100}` };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const sel = { ...actionBtn, fontWeight: 400 };
  const aviso = (bg, bd) => ({ background: bg, border: `1px solid ${bd}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 8 });

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
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>Cruce Compras WO</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>{mes ? `Compras por Documento · ${mesLbl(mes)}` : "Facturas del portal vs World Office"}</h1>
            {r0 && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>Cargado: {fmtAt(r0.at)} · {r0.autor || "—"} · {r0.archivo || "—"}{r0.desde ? ` · periodo ${fmtF(r0.desde)} a ${fmtF(r0.hasta)}` : ""}</div>}
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {meses.length > 0 && (
              <select value={mes || ""} onChange={(e) => { setSelM(e.target.value); setFlt(FLT0); setSel(new Set()); setAbierta(null); }} style={sel}>
                {[...meses].reverse().map((m) => <option key={m} value={m}>{mesLbl(m)}</option>)}
              </select>
            )}
            <button onClick={() => setNuevo(false)} disabled={busy || !configured} style={primario}>＋ Subir reporte de compras</button>
            {mes && <button onClick={() => setBorrar({ mes, conRevision: true })} disabled={busy} style={{ ...actionBtn, color: C.red }}>🗑 Eliminar reporte</button>}
            <button onClick={exportar} disabled={!listo} style={actionBtn}>⬇ Exportar Excel</button>
            <button onClick={() => window.print()} disabled={!listo} style={actionBtn}>🖨 Imprimir</button>
          </div>
        </div>

        {!configured ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Firebase no está configurado: el módulo necesita la base de datos.</div>
        ) : loading ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Cargando…</div>
        ) : !mes ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Aún no hay reportes: use "Subir reporte de compras" con el "Compras por Documento" de World Office.</div>
        ) : (
          <>
            {!listo ? (
              <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13, marginBottom: 12 }}>{facRaw ? "Cargando reporte…" : "Cargando facturas del portal…"}</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <Kpi label="Total reporte WO" valor={corto(rs.wo)} sub={`${rs.nWO} documentos`} />
                  <Kpi label="Total facturas del portal" valor={corto(rs.portal)} sub={`${rs.nPortal} facturas en el cruce`} />
                  <Kpi label="Docs cruzados OK" valor={`${pc("ok").n} de ${rs.nWO}`} sub={`${rs.nWO ? ((pc("ok").n / rs.nWO) * 100).toFixed(1) : 0}% de los documentos de WO · ${corto(pc("ok").valor)}`} color={C.green} />
                  <Kpi label="Revisados" valor={`${nRev.aprobado} de ${activas.length}`} sub={`${nRev.observado} observados · ${nRev.cambio} cambiaron · ${nRev.pendiente} pendientes`} color={C.green} />
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <Panel titulo="Valor por categoría">
                    <BarrasV datos={CATS.map(([k, n, c]) => ({ label: n.replace("Sin documento en WO", "Sin doc WO"), valor: pc(k).valor, color: "#" + c }))} />
                  </Panel>
                  <Panel titulo="Proveedores con más valor sin cruzar OK">
                    {topProv.length ? <BarrasH datos={topProv} /> : <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Todo cruzó OK.</div>}
                  </Panel>
                </div>
              </>
            )}

            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TABS.map(([k, n]) => {
                    const c = CAT[k]?.c;
                    return <button key={k} onClick={() => setTab(k)} style={{ ...actionBtn, ...(c ? { boxShadow: `inset 6px 0 0 #${c}`, paddingLeft: 16 } : {}), ...(tab === k ? { background: C.navy, color: C.white, borderColor: C.navy } : {}) }}>{n}{listo ? ` (${lista[k]?.length ?? 0})` : ""}</button>;
                  })}
                </div>
                <div className="no-print"><SearchBar search={search} setSearch={setSearch} placeholder="Buscar N.º ERP, proveedor, NIT..." /></div>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <select value={flt.cat} onChange={(e) => setFlt({ ...flt, cat: e.target.value })} style={sel}>
                  <option value="">Todas las categorías</option>
                  {CATS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                <input value={flt.prov} onChange={(e) => setFlt({ ...flt, prov: e.target.value })} placeholder="Proveedor o NIT…" style={{ ...sel, fontWeight: 400, width: 150 }} />
                <select value={flt.obs} onChange={(e) => setFlt({ ...flt, obs: e.target.value })} style={{ ...sel, maxWidth: 220 }}>
                  <option value="">Observación: todas</option>
                  <option value={SIN_OBS}>(sin observación)</option>
                  {obsOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={flt.rev} onChange={(e) => setFlt({ ...flt, rev: e.target.value })} style={sel}>
                  <option value="">Revisión: todos</option>
                  {[["pendiente", "Pendientes"], ["aprobado", "Aprobados"], ["observado", "Observados"], ["cambio", "Cambiados"]].map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                {hayFlt && <button onClick={() => setFlt(FLT0)} style={actionBtn}>Limpiar</button>}
              </div>
              {listo && !elim && marc.size > 0 && (
                <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.blueL, border: `1px solid ${C.blue}`, borderRadius: 4, padding: "6px 10px", marginBottom: 10, fontSize: 12 }}>
                  <b>{activas.filter((f) => marc.has(f.key)).length} seleccionados:</b>
                  <button disabled={busy} onClick={() => guardarRev(activas.filter((f) => marc.has(f.key)).map((f) => [f, { estado: "aprobado" }]))} style={primario}>Aprobar</button>
                  <button disabled={busy} onClick={() => guardarRev(activas.filter((f) => marc.has(f.key)).map((f) => [f, { estado: null }]))} style={actionBtn}>Volver a pendiente</button>
                  <button disabled={busy} onClick={() => { setMotivoE(""); setExcl(activas.filter((f) => marc.has(f.key))); }} style={{ ...actionBtn, color: C.red }}>Eliminar del cruce</button>
                  <button onClick={() => setSel(new Set())} style={actionBtn}>Quitar selección</button>
                </div>
              )}
              {!listo ? (
                <div style={{ fontSize: 12, color: C.g500, padding: 16, textAlign: "center" }}>Cargando…</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>{vista.length} registros · portal: <b style={{ color: C.navy }}>{fmt(sum("valorPortal"))}</b> · WO: <b style={{ color: C.navy }}>{fmt(sum("valorWO"))}</b> · diferencia: <b style={{ color: C.red }}>{fmt(sum("dif"))}</b></div>
                  <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr><th style={th}><input type="checkbox" title="Seleccionar las filas visibles" checked={vista.length > 0 && vista.slice(0, 500).every((f) => marc.has(f.key))} onChange={(e) => setSel(e.target.checked ? new Set([...marc, ...vista.slice(0, 500).map((f) => f.key)]) : new Set([...marc].filter((k) => !vista.some((f) => f.key === k))))} /></th>{COLS.map(([h, k, right]) => <th key={k} onClick={() => toggleSort(k)} style={{ ...th, ...(right ? { textAlign: "right" } : {}), cursor: "pointer", userSelect: "none" }}>{h} {ord.col === k ? (ord.dir === "asc" ? "▲" : "▼") : ""}</th>)}{elim && <th style={th} />}</tr>
                      </thead>
                      <tbody>
                        {vista.slice(0, 500).map((f) => {
                          const abierto = abierta === f.key;
                          return (
                            <Fragment key={f.key}>
                              <tr onClick={() => setAbierta(abierto ? null : f.key)} style={{ background: CAT[f.categoria] ? `#${CAT[f.categoria].c}40` : undefined, cursor: "pointer" }}>
                                <td style={td} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={marc.has(f.key)} onChange={(e) => setSel((o) => { const n = new Set(o); if (e.target.checked) n.add(f.key); else n.delete(f.key); return n; })} /></td>
                                {COLS.map(([, k, right]) => <td key={k} style={right ? tdN : td}>{cel(f, k)}</td>)}
                                {elim && <td style={td} onClick={(e) => e.stopPropagation()}><button disabled={busy} onClick={() => guardarRev([[f, { excluido: null, motivo: null }]])} style={actionBtn}>Restaurar</button></td>}
                              </tr>
                              {abierto && !elim && <tr><td colSpan={COLS.length + 1} style={{ padding: "0 8px" }}><EditorFila key={f.key} f={f} rec={revN[f.key]} est={rvOf(f)} filas={activas} disabled={busy} onGuardar={(g, parche) => guardarRev([[g, parche]])} onClose={() => setAbierta(null)} onEliminar={(fs) => { setMotivoE(""); setExcl(fs); }} /></td></tr>}
                            </Fragment>
                          );
                        })}
                        {!vista.length && <tr><td colSpan={COLS.length + 2} style={{ ...td, textAlign: "center", color: C.g500 }}>Sin registros.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {vista.length > 500 && <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>Mostrando 500 de {vista.length}; use filtros o exporte el Excel (trae todos).</div>}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {nuevo !== null && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>Subir reporte de compras</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 2 }}>
              "Compras por Documento" de World Office (.xlsx, .xls o .xlk)<br />
              <input type="file" accept=".xlsx,.xls,.xlk" onChange={(e) => setNuevo(e.target.files?.[0] || false)} style={{ fontSize: 12 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setNuevo(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={procesar} disabled={busy || !nuevo} style={primario}>{busy ? "Procesando…" : "Procesar"}</button>
            </div>
          </div>
        </div>
      )}

      {conf && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>Confirmar reporte</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
              Archivo: {conf.archivo}<br />
              Periodo detectado: {conf.wo.desde ? `${fmtF(conf.wo.desde)} a ${fmtF(conf.wo.hasta)}` : "no se encontró en el título"}<br />
              Mes: <input type="month" value={conf.mes} onChange={(e) => setConf({ ...conf, mes: e.target.value })} style={{ fontSize: 13, padding: "2px 6px", border: `1px solid ${C.g200}`, borderRadius: 4 }} /><br />
              Documentos: <b>{conf.wo.docs.length}</b> · total <b>{fmt(conf.wo.total)}</b>
              {conf.wo.desde.slice(0, 7) !== conf.wo.hasta.slice(0, 7) && <div style={aviso(C.orangeL, C.orange)}>El periodo abarca más de un mes: verifique que sea el reporte correcto.</div>}
              {existe && (
                <div style={aviso(C.redL, C.red)}>
                  Ya hay un reporte de ese mes ({res[conf.mes]?.archivo || "—"}): se reemplazará por completo.<br />
                  <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="checkbox" checked={!!conf.deCero} onChange={(e) => setConf({ ...conf, deCero: e.target.checked })} />
                    Empezar de cero: borrar también la revisión de ese mes
                  </label>
                  {!conf.deCero && <span style={{ fontSize: 11 }}>La revisión se conserva; las filas que cambien quedarán como "Cambió".</span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConf(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={confirmar} disabled={busy || !/^\d{4}-\d{2}$/.test(conf.mes || "")} style={primario}>{busy ? "Guardando…" : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {excl && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.red }}>Eliminar del cruce</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
              {excl.length === 1 ? "1 fila" : `${excl.length} filas`}. No borra el reporte WO ni la factura del portal; se puede restaurar desde la pestaña Eliminadas.
              <label style={{ display: "block", marginTop: 8, fontWeight: 600 }}>Motivo</label>
              <textarea autoFocus value={motivoE} onChange={(e) => setMotivoE(e.target.value)} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: 6, border: `1px solid ${C.g200}`, borderRadius: 4, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setExcl(null)} style={actionBtn}>Cancelar</button>
              <button disabled={busy || !motivoE.trim()} onClick={() => { const items = excl.map((f) => [f, { excluido: true, motivo: motivoE.trim() }]); setExcl(null); setAbierta(null); guardarRev(items); }} style={{ ...actionBtn, background: C.red, color: C.white, borderColor: C.red }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {borrar && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.red }}>Eliminar reporte de {mesLbl(borrar.mes)}</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
              Archivo: {res[borrar.mes]?.archivo || "—"} · {res[borrar.mes]?.n ?? "—"} documentos<br />
              Las facturas del portal no se tocan. No se puede deshacer.
              <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                <input type="checkbox" checked={borrar.conRevision} onChange={(e) => setBorrar({ ...borrar, conRevision: e.target.checked })} />
                Borrar también la revisión de ese mes ({borrar.mes === mes ? Object.keys(revN).length : "las"} filas revisadas o emparejadas)
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setBorrar(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={eliminar} disabled={busy} style={{ ...actionBtn, background: C.red, color: C.white, borderColor: C.red }}>{busy ? "Eliminando…" : "Eliminar"}</button>
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
