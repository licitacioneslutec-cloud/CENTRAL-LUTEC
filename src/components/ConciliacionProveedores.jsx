import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { fmt, corto, fmtF } from "../utils";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { MODO_PRUEBA } from "../contratosFirebase";
import { subscribeRuta, leerConciliacion, guardarConciliacionCxp, guardarRevision } from "../carteraFirebase";
import { leerCartera, fechaDeNombre, rango, RANGOS } from "../carteraExcel";
import { leerEstadoProveedor, conciliar, puente, resumenConc, compararConciliaciones, libroConciliacionCxp, nitKey, agruparLutec, aMapa, paresDe, claveFila, firmaDe, estadoRev, REV, CATS, CAT, CAMPOS_PROV } from "../cxpConciliacion";
import SearchBar from "./SearchBar";
import { Cascada, BarrasV, Linea, Kpi, Panel } from "./CarteraCharts";

const MAX_MB = 20;
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };
const VACIO = [], OBJ = {};
const REV_COLOR = { pendiente: [C.g200, C.g700], aprobado: [C.greenL, C.green], observado: [C.orangeL, C.orange], cambio: [C.redL, C.red] };
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");
const actionBtn = { background: C.white, borderStyle: "solid", borderWidth: 1, borderColor: C.g200, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const primario = { ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const FLT0 = { cat: "", rango: "", sug: false, rev: "" };
const TABS = [["todas", "Todas"], ...CATS.map(([k, n]) => [k, n]), ["cambios", "Cambios"]];
const MONEY = ["valorLutec", "saldoProv", "dif"];
const sg = (v) => (v < 0 ? "−" : "+") + corto(Math.abs(v));
const campo = (f, k, rv) => (k === "rango" ? f.dias : k === "categoria" ? CAT[f.categoria]?.n : k === "rev" ? rv(f) : f[k]);

// Panel de una fila: lado Lutec vs proveedor, emparejar / separar y revisión. onGuardar(fila, parche): el parche se guarda en el registro de esa fila.
function EditorFila({ f, rec, est, filas, onGuardar, onClose, disabled }) {
  const [nota, setNota] = useState(rec?.nota || ""), [q, setQ] = useState("");
  const esP = f.categoria === "soloP", lutecDe = (n, ok) => filas.find((x) => x.num === n && ok(x));
  const opts = filas.filter((x) => (esP ? x.categoria === "soloL" : x.categoria === "soloP") && (!q || String(x.num).toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 200);
  const go = (g, parche) => { if (g) { onGuardar(g, parche); onClose(); } };
  const lado = { flex: "1 1 220px", fontSize: 12, lineHeight: 1.7, color: C.g700 };
  const sugL = f.sugPar && lutecDe(f.sugPar.l, (x) => x.categoria !== "soloP");
  const b = (txt, fn, st = actionBtn) => <button key={txt} onClick={fn} disabled={disabled} style={st}>{txt}</button>;
  return (
    <div style={{ background: C.off, border: `1px solid ${C.g200}`, borderRadius: 6, padding: 12, margin: "4px 0" }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={lado}><b style={{ color: C.navy }}>Lutec</b><br />{esP ? "—" : <>Factura {f.num}{f.repetidoLutec ? " (suma de varios documentos)" : ""}<br />Valor: <b>{fmt(f.valorLutec ?? 0)}</b><br />Fecha {fmtF(f.fecha)} · vence {fmtF(f.vence)}</>}</div>
        <div style={lado}><b style={{ color: C.navy }}>Proveedor</b><br />{f.saldoProv == null ? "—" : <>Factura {f.numProv || f.num}{f.manual ? " (emparejada a mano)" : ""}<br />Saldo: <b>{fmt(f.saldoProv)}</b>{f.dif != null && <><br />Diferencia: <b style={{ color: C.red }}>{fmt(f.dif)}</b></>}</>}</div>
      </div>
      {f.sugerencia && <div style={{ fontSize: 12, color: C.g700, marginTop: 6 }}>Sugerencia: {f.sugerencia}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={esP ? "Buscar factura de Lutec…" : "Buscar factura del proveedor…"} style={{ fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4, width: 190 }} />
        <select value="" disabled={disabled} onChange={(e) => e.target.value && go(esP ? lutecDe(e.target.value, (x) => x.categoria === "soloL") : f, { par: esP ? f.num : e.target.value })} style={{ ...actionBtn, fontWeight: 400, maxWidth: 260 }}>
          <option value="">Emparejar con… ({opts.length})</option>
          {opts.map((x) => <option key={claveFila(x)} value={x.num}>{x.num} · {fmt(esP ? x.valorLutec : x.saldoProv)}</option>)}
        </select>
        {sugL && b(`Aplicar sugerencia (${f.sugPar.l} ↔ ${f.sugPar.p})`, () => go(sugL, { par: f.sugPar.p }), primario)}
        {!esP && !f.manual && f.saldoProv != null && b("Separar", () => go(f, { par: "" }))}
        {f.manual && b("Quitar emparejamiento manual", () => go(f, { par: null }))}
        {!esP && rec?.par === "" && b("Quitar separación", () => go(f, { par: null }))}
      </div>
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional; se guarda con Aprobar / Observación / Pendiente)" rows={2} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, fontSize: 12, padding: 6, border: `1px solid ${C.g200}`, borderRadius: 4, fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        {b("Aprobar", () => go(f, { estado: "aprobado", nota }), primario)}
        {b("Marcar con observación", () => go(f, { estado: "observado", nota }))}
        {b("Volver a pendiente", () => go(f, { estado: null, nota }))}
        <button onClick={onClose} style={actionBtn}>Cerrar</button>
        <span style={{ fontSize: 11, color: est === "cambio" ? C.red : C.g500 }}>{est === "cambio" ? "Cambió desde la revisión (valor, saldo o pareja distintos). " : ""}{rec?.at ? `Último cambio: ${rec.autor || "—"} · ${fmtAt(rec.at)}` : ""}</span>
      </div>
    </div>
  );
}

// Resuelve los archivos pendientes de leer; si un formato no se reconoce deja `pend` para elegir las columnas a mano.
function intentar(c) {
  const o = { ...c, pend: null };
  for (const [que, wb, mk, rk] of [["prov", "wbP", "mapeo", "prov"], ["apto", "wbA", "mapeoApto", "apto"]]) {
    if (!o[wb] || o[rk]) continue;
    try { o[rk] = leerEstadoProveedor(o[wb], o[mk]); o[mk] = o[rk].mapeo; } catch (e) {
      if (!e.cabeceras) throw e;
      o.pend = { que, mk, cabeceras: e.cabeceras, sel: {} };
      break;
    }
  }
  return o;
}

export default function ConciliacionProveedores({ user, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [res, setRes] = useState({}), [provs, setProvs] = useState({}), [rev, setRev] = useState({});
  const [marc, setSel] = useState(new Set()), [abierta, setAbierta] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [selNit, setSelNit] = useState(null), [selF, setSelF] = useState(null);
  const [data, setData] = useState({ nit: null, fecha: null, prev: null, act: null, ant: null });
  const [recarga, setRecarga] = useState(0);
  const [tab, setTab] = useState("todas");
  const [flt, setFlt] = useState(FLT0), [search, setSearch] = useState("");
  const [ord, setOrd] = useState({ col: "num", dir: "asc" });
  const toggleSort = (col) => setOrd((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  const [nuevo, setNuevo] = useState(null); // { fl, fp, fa }: archivos elegidos
  const [conf, setConf] = useState(null); // lectura lista para confirmar
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    const u = [subscribeRuta(dbRef.current, "cxp/resumen", (v) => { setRes(v); setLoading(false); }), subscribeRuta(dbRef.current, "cxp/proveedores", setProvs), subscribeRuta(dbRef.current, "cxp/revision", setRev)];
    return () => u.forEach((f) => f());
  }, [configured]);

  const nombreDe = (k) => provs[k]?.nombre || k;
  const nits = useMemo(() => [...new Set([...Object.keys(res), ...Object.keys(provs)])].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), "es")), [res, provs]); // eslint-disable-line react-hooks/exhaustive-deps
  const nit = selNit && nits.includes(selNit) ? selNit : nits[0] || null;
  const fechas = useMemo(() => Object.keys(res[nit] || {}).sort(), [res, nit]);
  const fecha = selF && res[nit]?.[selF] ? selF : fechas[fechas.length - 1] || null; // por defecto la última
  const prev = fecha ? fechas[fechas.indexOf(fecha) - 1] || null : null;

  useEffect(() => {
    if (!nit || !fecha) return;
    let vivo = true;
    Promise.all([leerConciliacion(dbRef.current, nit, fecha), prev ? leerConciliacion(dbRef.current, nit, prev) : null])
      .then(([act, ant]) => vivo && setData({ nit, fecha, prev, act, ant }))
      .catch((e) => vivo && showToast("No se pudo leer la conciliación: " + (e.message || e)));
    return () => { vivo = false; };
  }, [nit, fecha, prev, recarga]);

  const cargado = data.nit === nit && data.fecha === fecha && data.prev === prev && !!data.act;
  const revN = rev[nit] || OBJ;
  // Fuentes guardadas → las filas se calculan con las parejas de la revisión. Registro viejo (solo `filas`): solo lectura.
  const fuentes = useMemo(() => (cargado && data.act.lutec ? { lutec: aMapa(data.act.lutec), proveedor: aMapa(data.act.prov), apto: aMapa(data.act.apto) } : null), [cargado, data]);
  const legacy = cargado && !fuentes;
  const filas = useMemo(() => (!cargado ? VACIO : fuentes ? conciliar(fuentes, paresDe(revN, fuentes.lutec)) : Object.values(data.act.filas || {})), [cargado, data, fuentes, revN]);
  const filasAnt = useMemo(() => { const a = data.ant; return !a ? VACIO : a.lutec ? conciliar({ lutec: aMapa(a.lutec), proveedor: aMapa(a.prov), apto: aMapa(a.apto) }, paresDe(revN, aMapa(a.lutec))) : Object.values(a.filas || {}); }, [data, revN]);
  const comp = useMemo(() => (cargado && prev ? compararConciliaciones(filasAnt, filas) : null), [cargado, prev, filasAnt, filas]);
  const rvOf = (f) => (legacy ? "pendiente" : estadoRev(f, revN[claveFila(f)]));
  const nRev = { aprobado: 0, observado: 0, cambio: 0, pendiente: 0 };
  if (!legacy) for (const f of filas) nRev[rvOf(f)]++;
  const puedeRev = !legacy && tab !== "cambios";
  const r0 = nit && fecha ? res[nit]?.[fecha] : null, rp = nit && prev ? res[nit]?.[prev] : null;
  const rs = useMemo(() => (cargado ? resumenConc(filas) : null), [cargado, filas]);
  const r = r0 && (rs ? { ...r0, ...rs } : r0); // totales y categorías en vivo (con las parejas actuales)
  const pu = useMemo(() => puente(filas), [filas]);
  const lista = useMemo(() => ({ todas: filas, ...Object.fromEntries(CATS.map(([k]) => [k, filas.filter((f) => f.categoria === k)])), cambios: comp || [] }), [filas, comp]);

  const base = lista[tab] ?? VACIO;
  const vista = useMemo(() => {
    const q = search.trim().toLowerCase(), numerica = MONEY.includes(ord.col) || ord.col === "dias" || ord.col === "rango";
    return base.filter((f) => (!q || [f.num, f.numProv, f.sugerencia, CAT[f.categoria]?.n].some((v) => String(v ?? "").toLowerCase().includes(q))) && (!flt.cat || f.categoria === flt.cat) && (!flt.rango || (f.dias != null && rango(f.dias) === flt.rango)) && (!flt.sug || f.sugerencia) && (!flt.rev || rvOf(f) === flt.rev))
      .sort((a, b) => { const x = campo(a, ord.col, rvOf), y = campo(b, ord.col, rvOf), c = numerica ? (x ?? 0) - (y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""), "es", { numeric: true }); return ord.dir === "desc" ? -c : c; });
  }, [base, search, flt, ord, legacy, revN]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = (k) => vista.reduce((s, f) => s + (f[k] ?? 0), 0);
  const COLS = [["Categoría", "categoria"], ...(tab === "cambios" ? [["Cambio", "cambio"], ["De", "de"]] : []), ["Factura", "num"], ["Fecha", "fecha"], ["Vence", "vence"], ["Días", "dias", 1], ["Rango", "rango"], ...(puedeRev ? [["Revisión", "rev"]] : []), ["Valor Lutec", "valorLutec", 1], ["Saldo proveedor", "saldoProv", 1], ["Diferencia", "dif", 1], ["Sugerencia", "sugerencia"]];
  const cel = (f, k) => {
    if (k === "categoria") return <span style={{ background: `#${CAT[f.categoria]?.c || "D9D9D9"}`, color: C.g900, borderRadius: 3, padding: "1px 6px", fontSize: 11, whiteSpace: "nowrap" }}>{CAT[f.categoria]?.n || f.categoria}</span>;
    if (k === "rev") { const e = rvOf(f), [bg, fg] = REV_COLOR[e]; return <span title={e === "cambio" ? "Cambió desde la revisión" : undefined} style={{ background: bg, color: fg, borderRadius: 3, padding: "1px 6px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{REV[e]}</span>; }
    if (k === "num") return <>{f.num}{f.numProv && <span title="Emparejada a mano con una factura del proveedor de otro número" style={{ color: C.blue }}> ↔ {f.numProv} (manual)</span>}{f.repetidoLutec && <span title="Número repetido en Lutec: valores sumados" style={{ color: C.orange, marginLeft: 4 }}>↻</span>}</>;
    if (k === "fecha" || k === "vence") return fmtF(f[k]);
    if (k === "rango") return f.dias == null ? "—" : rango(f.dias);
    if (MONEY.includes(k)) return f[k] == null ? "—" : fmt(f[k]);
    return f[k] ?? (k === "dias" ? "—" : "");
  };
  const hayFlt = Object.keys(FLT0).some((k) => flt[k] !== FLT0[k]);

  const puenteItems = (() => {
    const s1 = pu.saldoProv + pu.diferencias, s2 = s1 + pu.apto, s3 = s2 + pu.soloLutec;
    return [
      { label: "Saldo prov.", de: 0, a: pu.saldoProv, color: C.navy, txt: corto(pu.saldoProv) },
      { label: "Diferencias", de: pu.saldoProv, a: s1, color: "#" + CAT.dif.c, txt: sg(pu.diferencias) },
      { label: "Cruce apto", de: s1, a: s2, color: "#" + CAT.apto.c, txt: sg(pu.apto) },
      { label: "Solo Lutec", de: s2, a: s3, color: "#" + CAT.soloL.c, txt: sg(pu.soloLutec) },
      { label: "Solo prov.", de: s3, a: s3 + pu.soloProv, color: "#" + CAT.soloP.c, txt: sg(pu.soloProv) },
      { label: "Saldo Lutec", de: 0, a: pu.saldoLutec, color: C.navy, txt: corto(pu.saldoLutec) },
    ];
  })();

  // ─── Nueva conciliación ───
  const procesar = async () => {
    const { fl, fp, fa } = nuevo;
    setBusy(true);
    try {
      const rd = async (f) => {
        if (f.size > MAX_MB * 1048576) throw new Error(`"${f.name}" pesa más de ${MAX_MB} MB y no se leyó.`);
        return XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      };
      const lutec = leerCartera(await rd(fl)), primera = Object.values(lutec.facturas)[0];
      if (!primera) throw new Error("El archivo de Lutec no tiene documentos.");
      const nk = nitKey(primera.nit, primera.cli), pv = provs[nk] || {}, fNombre = fechaDeNombre(fl.name);
      setConf(intentar({ lutec, nombre: primera.cli, nit: primera.nit, nk, wbP: await rd(fp), wbA: fa ? await rd(fa) : null, mapeo: pv.mapeo || null, mapeoApto: pv.mapeoApto || null, prov: null, apto: null, archivos: { lutec: fl.name, prov: fp.name, apto: fa?.name || null }, fNombre, fecha: fNombre || lutec.fechaCorte }));
      setNuevo(null);
    } catch (err) { showToast(err.message || String(err)); }
    setBusy(false);
  };
  const aplicarMapeo = () => {
    const { mk, sel } = conf.pend;
    try { setConf(intentar({ ...conf, [mk]: sel })); } catch (err) { showToast(err.message || String(err)); }
  };
  const calc = useMemo(() => {
    if (!conf || conf.pend || !conf.prov) return null;
    const f = conciliar({ lutec: conf.lutec.facturas, proveedor: conf.prov.facturas, apto: conf.apto?.facturas || {} }, paresDe(rev[conf.nk], conf.lutec.facturas));
    return { filas: f, resumen: resumenConc(f), pu: puente(f) };
  }, [conf?.prov, conf?.apto, conf?.lutec, conf?.pend, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const existe = !!(conf && res[conf.nk]?.[conf.fecha]);

  const confirmar = async () => {
    setBusy(true);
    try {
      const pv = provs[conf.nk] || {};
      await guardarConciliacionCxp(dbRef.current, conf.nk, conf.fecha, {
        prov: { nombre: conf.nombre, nit: conf.nit, mapeo: conf.mapeo ?? pv.mapeo ?? null, mapeoApto: conf.mapeoApto ?? pv.mapeoApto ?? null },
        conc: { at: new Date().toISOString(), autor: user.name, archivos: conf.archivos, lutec: Object.values(agruparLutec(conf.lutec.facturas)), prov: Object.values(conf.prov.facturas), apto: Object.values(conf.apto?.facturas || {}) },
        resumen: calc.resumen,
      });
      setSelNit(conf.nk); setSelF(conf.fecha); setRecarga((n) => n + 1);
      showToast(`Conciliación del ${fmtF(conf.fecha)} guardada`);
      setConf(null);
    } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };

  // Revisión: items = [[fila, parche]]; null en el parche borra el campo. Un solo update (+ resumen de esta fecha recalculado con las nuevas parejas).
  const guardarRev = async (items) => {
    if (!fuentes) return;
    const at = new Date().toISOString(), cambios = {};
    for (const [f, parche] of items) {
      const k = claveFila(f), x = { ...(k in cambios ? cambios[k] : revN[k]), ...parche, autor: user.name, at };
      if ("estado" in parche) x.firma = parche.estado ? firmaDe(f) : null;
      for (const c of Object.keys(x)) if (x[c] == null || (c === "nota" && !x[c])) delete x[c];
      cambios[k] = x.par !== undefined || x.estado || x.nota ? x : null;
    }
    const nr = { ...revN };
    for (const [k, v] of Object.entries(cambios)) { if (v) nr[k] = v; else delete nr[k]; }
    setBusy(true);
    try { await guardarRevision(dbRef.current, nit, cambios, fecha, resumenConc(conciliar(fuentes, paresDe(nr, fuentes.lutec)))); setSel(new Set()); } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };

  const exportar = () => XLSX.writeFile(libroConciliacionCxp(XLSX, { nombre: nombreDe(nit), fecha, filas, resumen: rs, revision: (f) => { const rc = revN[claveFila(f)]; return [REV[rvOf(f)], rc?.nota || "", rc?.autor || "", f.numProv ? `${f.numProv}${f.manual ? " (manual)" : ""}` : ""]; } }), `Conciliacion_${nit}_${fecha}.xlsx`);

  const th = { textAlign: "left", fontSize: 10, color: C.g500, textTransform: "uppercase", padding: "6px 8px", borderBottom: `1px solid ${C.g200}`, whiteSpace: "nowrap" };
  const td = { fontSize: 12, padding: "6px 8px", borderBottom: `1px solid ${C.g100}` };
  const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const sel = { ...actionBtn, fontWeight: 400 };
  const pc = (k) => r?.porCat?.[k];
  const pctOk = r?.lutec ? ((pc("ok")?.valor || 0) / r.lutec) * 100 : 0;

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
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>Conciliación Proveedores</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>{nit ? nombreDe(nit) : "Cartera Lutec vs proveedor"}{fecha ? ` · ${fmtF(fecha)}` : ""}</h1>
            {r && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>Cargado: {fmtAt(r.at)} · {r.autor || "—"} · {prev ? `comparado con ${fmtF(prev)}` : "Sin conciliación anterior"}</div>}
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {nits.length > 0 && (
              <select value={nit || ""} onChange={(e) => { setSelNit(e.target.value); setSelF(null); setFlt(FLT0); setSel(new Set()); setAbierta(null); }} style={sel}>
                {nits.map((k) => <option key={k} value={k}>{nombreDe(k)}</option>)}
              </select>
            )}
            {fechas.length > 0 && (
              <select value={fecha || ""} onChange={(e) => { setSelF(e.target.value); setSel(new Set()); setAbierta(null); }} style={sel}>
                {[...fechas].reverse().map((f) => <option key={f} value={f}>{fmtF(f)}</option>)}
              </select>
            )}
            <button onClick={() => setNuevo({ fl: null, fp: null, fa: null })} disabled={busy || !configured} style={primario}>＋ Nueva conciliación</button>
            <button onClick={exportar} disabled={!cargado || !r0} style={actionBtn}>⬇ Exportar Excel</button>
            <button onClick={() => window.print()} disabled={!cargado} style={actionBtn}>🖨 Imprimir</button>
          </div>
        </div>

        {!configured ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Firebase no está configurado: el módulo necesita la base de datos.</div>
        ) : loading ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Cargando…</div>
        ) : !r ? (
          <div style={{ ...card, textAlign: "center", color: C.g500, fontSize: 13 }}>Aún no hay conciliaciones: use "Nueva conciliación" con el 30-60-90 de World Office y el estado de cuenta del proveedor.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Kpi label="Saldo Lutec" valor={corto(r.lutec || 0)} sub={fmt(r.lutec || 0)} />
              <Kpi label="Saldo proveedor" valor={corto(r.prov || 0)} sub={fmt(r.prov || 0)} />
              <Kpi label="Diferencia total" valor={corto(r.dif || 0)} sub={rp ? `antes ${fmt(rp.dif || 0)}` : "Sin conciliación anterior"} color={C.red} />
              {!legacy && <Kpi label="Revisados" valor={`${nRev.aprobado} de ${filas.length}`} sub={`${nRev.observado} observados · ${nRev.cambio} cambiaron · ${nRev.pendiente} pendientes`} color={C.green} />}
              <Kpi label="% conciliado (OK)" valor={pctOk.toFixed(1) + "%"} sub={`${pc("ok")?.n ?? 0} de ${r.nDocs ?? 0} documentos`} color={C.green} />
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Panel titulo="Puente Lutec ↔ proveedor">
                {cargado ? <Cascada items={puenteItems} /> : <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Cargando…</div>}
                {cargado && <div style={{ fontSize: 11, textAlign: "center", color: pu.cuadra ? C.green : C.red }}>{pu.cuadra ? "El puente cuadra con el saldo de Lutec" : "El puente no cuadra"}</div>}
              </Panel>
              <Panel titulo="Valor por categoría">
                <BarrasV datos={CATS.map(([k, n, c]) => ({ label: n, valor: pc(k)?.valor || 0, color: "#" + c }))} />
              </Panel>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <Panel titulo="Evolución de la diferencia (Lutec − proveedor)">
                <Linea puntos={fechas.map((f) => ({ fecha: f, dif: res[nit][f].dif || 0 }))} series={[["dif", C.red, "Diferencia"]]} />
              </Panel>
            </div>

            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TABS.map(([k, n]) => {
                    const c = CAT[k]?.c;
                    return <button key={k} onClick={() => setTab(k)} style={{ ...actionBtn, ...(c ? { boxShadow: `inset 6px 0 0 #${c}`, paddingLeft: 16 } : {}), ...(tab === k ? { background: C.navy, color: C.white, borderColor: C.navy } : {}) }}>{n}{cargado ? ` (${lista[k]?.length ?? 0})` : ""}</button>;
                  })}
                </div>
                <div className="no-print"><SearchBar search={search} setSearch={setSearch} placeholder="Buscar factura, sugerencia..." /></div>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <select value={flt.cat} onChange={(e) => setFlt({ ...flt, cat: e.target.value })} style={sel}>
                  <option value="">Todas las categorías</option>
                  {CATS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                <select value={flt.rango} onChange={(e) => setFlt({ ...flt, rango: e.target.value })} style={sel}>
                  <option value="">Todos los rangos</option>
                  {RANGOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <label style={{ fontSize: 12, color: C.g700, display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={flt.sug} onChange={(e) => setFlt({ ...flt, sug: e.target.checked })} />Solo con sugerencia</label>
                {!legacy && (
                  <select value={flt.rev} onChange={(e) => setFlt({ ...flt, rev: e.target.value })} style={sel}>
                    <option value="">Revisión: todos</option>
                    {[["pendiente", "Pendientes"], ["aprobado", "Aprobados"], ["observado", "Observados"], ["cambio", "Cambiados"]].map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                )}
                {hayFlt && <button onClick={() => setFlt(FLT0)} style={actionBtn}>Limpiar</button>}
              </div>
              {legacy && <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: 8, fontSize: 12, marginBottom: 10 }}>Esta conciliación se guardó en un formato anterior (sin fuentes): solo se puede consultar. Vuelva a subir los archivos de esta fecha para poder revisar y emparejar.</div>}
              {puedeRev && marc.size > 0 && (
                <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.blueL, border: `1px solid ${C.blue}`, borderRadius: 4, padding: "6px 10px", marginBottom: 10, fontSize: 12 }}>
                  <b>{filas.filter((f) => marc.has(claveFila(f))).length} seleccionados:</b>
                  <button disabled={busy} onClick={() => guardarRev(filas.filter((f) => marc.has(claveFila(f))).map((f) => [f, { estado: "aprobado" }]))} style={primario}>Aprobar</button>
                  <button disabled={busy} onClick={() => guardarRev(filas.filter((f) => marc.has(claveFila(f))).map((f) => [f, { estado: null }]))} style={actionBtn}>Volver a pendiente</button>
                  <button onClick={() => setSel(new Set())} style={actionBtn}>Quitar selección</button>
                </div>
              )}
              {!cargado ? (
                <div style={{ fontSize: 12, color: C.g500, padding: 16, textAlign: "center" }}>Cargando…</div>
              ) : tab === "cambios" && !prev ? (
                <div style={{ fontSize: 12, color: C.g500, padding: 16, textAlign: "center" }}>Sin conciliación anterior: suba otra para ver cambios.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>{vista.length} registros · Lutec: <b style={{ color: C.navy }}>{fmt(sum("valorLutec"))}</b> · proveedor: <b style={{ color: C.navy }}>{fmt(sum("saldoProv"))}</b> · diferencia: <b style={{ color: C.red }}>{fmt(sum("dif"))}</b></div>
                  <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>{puedeRev && <th style={th}><input type="checkbox" title="Seleccionar las filas visibles" checked={vista.length > 0 && vista.slice(0, 500).every((f) => marc.has(claveFila(f)))} onChange={(e) => setSel(e.target.checked ? new Set([...marc, ...vista.slice(0, 500).map(claveFila)]) : new Set([...marc].filter((k) => !vista.some((f) => claveFila(f) === k))))} /></th>}{COLS.map(([h, k, right]) => <th key={k} onClick={() => toggleSort(k)} style={{ ...th, ...(right ? { textAlign: "right" } : {}), cursor: "pointer", userSelect: "none" }}>{h} {ord.col === k ? (ord.dir === "asc" ? "▲" : "▼") : ""}</th>)}</tr>
                      </thead>
                      <tbody>
                        {vista.slice(0, 500).map((f) => {
                          const k0 = claveFila(f), abierto = puedeRev && abierta === k0;
                          return (
                            <Fragment key={k0}>
                              <tr onClick={() => puedeRev && setAbierta(abierto ? null : k0)} style={{ background: CAT[f.categoria] ? `#${CAT[f.categoria].c}40` : undefined, cursor: puedeRev ? "pointer" : undefined }}>
                                {puedeRev && <td style={td} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={marc.has(k0)} onChange={(e) => setSel((o) => { const n = new Set(o); if (e.target.checked) n.add(k0); else n.delete(k0); return n; })} /></td>}
                                {COLS.map(([, k, right]) => <td key={k} style={right ? tdN : td}>{cel(f, k)}</td>)}
                              </tr>
                              {abierto && <tr><td colSpan={COLS.length + 1} style={{ padding: "0 8px" }}><EditorFila key={k0} f={f} rec={revN[k0]} est={rvOf(f)} filas={filas} disabled={busy} onGuardar={(g, parche) => guardarRev([[g, parche]])} onClose={() => setAbierta(null)} /></td></tr>}
                            </Fragment>
                          );
                        })}
                        {!vista.length && <tr><td colSpan={COLS.length + 1} style={{ ...td, textAlign: "center", color: C.g500 }}>Sin registros.</td></tr>}
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

      {nuevo && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>Nueva conciliación</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 2 }}>
              {[["fl", "Cartera Lutec (30-60-90 de World Office) *"], ["fp", "Estado de cuenta del proveedor *"], ["fa", "Reporte de cruce apto (opcional)"]].map(([k, n]) => (
                <div key={k}>{n}<br /><input type="file" accept=".xlsx,.xls" onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.files?.[0] || null })} style={{ fontSize: 12 }} /></div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setNuevo(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={procesar} disabled={busy || !nuevo.fl || !nuevo.fp} style={primario}>{busy ? "Procesando…" : "Procesar"}</button>
            </div>
          </div>
        </div>
      )}

      {conf && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>{conf.pend ? "Elegir columnas" : "Confirmar conciliación"}</h3>
            {conf.pend ? (
              <div style={{ fontSize: 13, color: C.g700, lineHeight: 2 }}>
                No se reconocieron las columnas del archivo {conf.pend.que === "prov" ? "del proveedor" : "de cruce apto"}. Indique cuál es cada una (se recordará para este proveedor).
                {CAMPOS_PROV.map(([k, n]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span>{n}</span>
                    <select value={conf.pend.sel[k] || ""} onChange={(e) => setConf({ ...conf, pend: { ...conf.pend, sel: { ...conf.pend.sel, [k]: e.target.value } } })} style={{ ...sel, maxWidth: 260 }}>
                      <option value="">—</option>
                      {conf.pend.cabeceras.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
                Proveedor: <b>{conf.nombre}</b> ({conf.nit})<br />
                Archivos: {conf.archivos.lutec} · {conf.archivos.prov}{conf.archivos.apto ? ` · ${conf.archivos.apto}` : " · sin cruce apto"}<br />
                Fecha: <input type="date" value={conf.fecha} onChange={(e) => setConf({ ...conf, fecha: e.target.value })} style={{ fontSize: 13, padding: "2px 6px", border: `1px solid ${C.g200}`, borderRadius: 4 }} />
                <span style={{ fontSize: 11, color: C.g500 }}> título: {fmtF(conf.lutec.fechaCorte)}{conf.fNombre ? ` · nombre del archivo: ${fmtF(conf.fNombre)}` : ""}</span><br />
                Saldo Lutec: <b>{fmt(calc.resumen.lutec)}</b> · proveedor: <b>{fmt(calc.resumen.prov)}</b> · diferencia: <b>{fmt(calc.resumen.dif)}</b><br />
                {CATS.map(([k, n, c]) => <div key={k}><span style={{ display: "inline-block", width: 10, height: 10, background: `#${c}`, marginRight: 6 }} />{n}: <b>{calc.resumen.porCat[k].n}</b> · {fmt(calc.resumen.porCat[k].valor)}</div>)}
                {conf.lutec.totalGeneral !== null && Math.abs(conf.lutec.total - conf.lutec.totalGeneral) > 1 && (
                  <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 8 }}>La suma de los documentos de Lutec ({fmt(conf.lutec.total)}) difiere del "Total general" del archivo ({fmt(conf.lutec.totalGeneral)}).</div>
                )}
                {conf.fNombre && conf.fNombre !== conf.lutec.fechaCorte && (
                  <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 8 }}>El nombre del archivo ({fmtF(conf.fNombre)}) y el título ({fmtF(conf.lutec.fechaCorte)}) no coinciden: verifique la fecha.</div>
                )}
                {!calc.pu.cuadra && <div style={{ background: C.redL, border: `1px solid ${C.red}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 8 }}>El puente no cuadra con el saldo de Lutec.</div>}
                {existe && <div style={{ background: C.redL, border: `1px solid ${C.red}`, borderRadius: 4, padding: 8, fontSize: 12, marginTop: 8 }}>Ya existe una conciliación de ese proveedor en esa fecha, se reemplazará.</div>}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConf(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              {conf.pend
                ? <button onClick={aplicarMapeo} disabled={!conf.pend.sel.num || !conf.pend.sel.saldo || conf.pend.sel.num === conf.pend.sel.saldo} style={primario}>Aplicar</button>
                : <button onClick={confirmar} disabled={busy || !calc || !/^\d{4}-\d{2}-\d{2}$/.test(conf.fecha || "")} style={primario}>{busy ? "Guardando…" : "Confirmar"}</button>}
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
