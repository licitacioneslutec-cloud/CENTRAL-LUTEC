import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { fmt } from "../utils";
import { subscribeRuta, guardarBanco, guardarConciliacion, leerCorte } from "../carteraFirebase";
import { leerBanco, clienteDe, sugerir, tipoDe, aliasKey, compararCortes, libroConciliacion } from "../carteraExcel";
import SearchBar from "./SearchBar";

const MAX_MB = 20;
const fmtF = (f) => (f ? f.split("-").reverse().join("/") : "—");
const pct = (x) => x.toFixed(2) + "%";
const actionBtn = { background: C.white, borderStyle: "solid", borderWidth: 1, borderColor: C.g200, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const primario = { ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent };
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const th = { textAlign: "left", fontSize: 10, color: C.g500, textTransform: "uppercase", padding: "6px 8px", borderBottom: `1px solid ${C.g200}`, whiteSpace: "nowrap" };
const td = { fontSize: 12, padding: "6px 8px", borderBottom: `1px solid ${C.g100}` };
const tdN = { ...td, textAlign: "right", whiteSpace: "nowrap" };
const inp = { ...actionBtn, fontWeight: 400 };
const FINES = [["CARTERA", "CARTERA"], ["ANTICIPO", "ANTICIPO"], ["SIN", "Sin clasificar"], ["TODOS", "Todos"]];
const ESTADOS = [["pendiente", "Pendientes"], ["conciliado", "Conciliados"], ["descartado", "Descartados"], ["todos", "Todos"]];
const estadoDe = (m) => m.c?.estado || "pendiente";

const Kpi = ({ label, valor, sub, color = C.navy }) => (
  <div style={{ ...card, flex: "1 1 160px" }}>
    <div style={{ fontSize: 10, color: C.g500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
    {sub && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>{sub}</div>}
  </div>
);

// Detalle de un movimiento: cliente, sugerencias y selección manual contra el corte vigente a la fecha del pago.
function Detalle({ m, fechas, obtener, alias, usadas, user, db, showToast }) {
  const pool = [...fechas].reverse().find((f) => f <= m.fecha) || fechas[0]; // corte más reciente ≤ fecha del pago (si no hay, el más antiguo)
  const sig = fechas[fechas.indexOf(pool) + 1] || null;
  const [dat, setDat] = useState(null);
  const [manual, setManual] = useState(null); // nit elegido a mano
  const [ms, setMs] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([obtener(pool), obtener(sig)])
      .then(([a, b]) => vivo && setDat({ a, b, pool, sig }))
      .catch((e) => vivo && showToast("No se pudo leer el corte: " + (e.message || e)));
    return () => { vivo = false; };
  }, [pool, sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const listo = !!dat && dat.pool === pool && dat.sig === sig && !!dat.a;
  const A = listo ? dat.a : null, B = listo ? dat.b : null;
  const clientes = useMemo(() => {
    const u = {};
    for (const f of Object.values(A || {})) u[f.nit] = f.cli;
    return Object.entries(u).map(([nit, cli]) => ({ nit, cli })).sort((x, y) => x.cli.localeCompare(y.cli, "es"));
  }, [A]);
  const det = useMemo(() => clienteDe(m, clientes, alias), [m, clientes, alias]);
  const nit = manual ?? det?.nit ?? "";
  const facs = useMemo(() => (A && nit ? Object.entries(A).filter(([, f]) => f.nit === nit).map(([k, f]) => ({ ...f, k })) : []), [A, nit]);
  const sal = useMemo(() => new Set(A && B ? Object.keys(A).filter((k) => !B[k]) : []), [A, B]); // salieron en el corte siguiente
  const sugs = useMemo(() => sugerir(m.valor, facs, sal), [m.valor, facs, sal]);

  if (!listo) return <div style={{ fontSize: 12, color: C.g500, padding: 8 }}>Cargando corte…</div>;
  const nombre = (k) => `${A[k].doc} ${A[k].num}`;

  const guardar = async (estado, claves = []) => {
    const suma = claves.reduce((s, k) => s + A[k].valor, 0);
    const ak = aliasKey(m.tercero);
    const aprende = estado === "conciliado" && nit && ak && alias[ak] !== nit && !(manual === null && det?.por === "nombre"); // cliente elegido a mano o por NIT
    const reg = { estado, at: new Date().toISOString(), autor: user.name };
    if (estado === "conciliado") Object.assign(reg, { facturas: claves, suma, diferencia: suma - m.valor, tipo: tipoDe(suma, m.valor), cliente: nit, clienteNombre: clientes.find((c) => c.nit === nit)?.cli || "", corte: pool, det: claves.map(nombre).join(", ") });
    setBusy(true);
    try { await guardarConciliacion(db, m.id, reg, aprende ? { key: ak, nit } : null); } catch (e) { showToast("No se pudo guardar: " + (e.message || e)); }
    setBusy(false);
  };

  if (m.c) {
    return (
      <div style={{ fontSize: 12, padding: 8 }}>
        <b>{m.c.estado === "conciliado" ? "Conciliado" : "Descartado"}</b> por {m.c.autor} el {new Date(m.c.at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
        {m.c.estado === "conciliado" && <> · {m.c.clienteNombre} · {m.c.det} · suma {fmt(m.c.suma)} · diferencia {fmt(m.c.diferencia)} ({m.c.tipo})</>}
        <div style={{ marginTop: 8 }}><button disabled={busy} onClick={async () => { setBusy(true); try { await guardarConciliacion(db, m.id, null); } catch (e) { showToast("No se pudo reabrir: " + (e.message || e)); } setBusy(false); }} style={actionBtn}>Reabrir</button></div>
      </div>
    );
  }

  const sumaM = facs.filter((f) => ms[f.k]).reduce((s, f) => s + f.valor, 0), clavesM = facs.filter((f) => ms[f.k]).map((f) => f.k);
  const difM = sumaM - m.valor;
  return (
    <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: C.g700, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        Cliente:
        <select value={nit} onChange={(e) => { setManual(e.target.value); setMs({}); }} style={{ ...inp, maxWidth: 320 }}>
          <option value="">— elegir —</option>
          {nit && !clientes.some((c) => c.nit === nit) && <option value={nit}>{nit} (sin facturas en el corte)</option>}
          {clientes.map((c) => <option key={c.nit} value={c.nit}>{c.cli}</option>)}
        </select>
        <span style={{ color: C.g500 }}>{manual !== null ? "elegido a mano" : det ? `detectado por ${det.por === "nit" ? "NIT de la descripción" : det.por}` : "no detectado"} · corte de referencia {fmtF(pool)}{sig ? ` (salidas según ${fmtF(sig)})` : ""}</span>
      </div>
      {nit && !facs.length && <div style={{ fontSize: 12, color: C.g500 }}>El cliente no tiene facturas en el corte del {fmtF(pool)}.</div>}
      {sugs.map((s, i) => (
        <div key={i} style={{ border: `1px solid ${C.g200}`, borderRadius: 6, padding: 8, fontSize: 12, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <b style={{ color: s.tipo === "exacto" ? C.green : s.tipo === "abono" ? C.orange : C.navy }}>{s.tipo === "abono" ? "abono parcial" : s.tipo}</b> · suma {fmt(s.suma)} · diferencia {fmt(s.diferencia)} ({pct(s.pctRetencion)}{s.tipo === "abono" ? " queda por pagar" : ""})
            <div style={{ color: C.g500 }}>{s.claves.map((k) => `${nombre(k)} ${fmt(A[k].valor)}${sal.has(k) ? " ✓salió" : ""}`).join(" · ")}</div>
          </div>
          <button disabled={busy} onClick={() => guardar("conciliado", s.claves)} style={primario}>Confirmar</button>
        </div>
      ))}
      {nit && !sugs.length && facs.length > 0 && <div style={{ fontSize: 12, color: C.g500 }}>Sin combinación que explique el pago: use la selección manual.</div>}
      {facs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Selección manual</div>
          <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.g100}`, borderRadius: 4 }}>
            {facs.map((f) => (
              <label key={f.k} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 8px", cursor: "pointer", alignItems: "center" }}>
                <input type="checkbox" checked={!!ms[f.k]} onChange={(e) => setMs({ ...ms, [f.k]: e.target.checked })} />
                <span style={{ flex: 1 }}>{f.doc} {f.num} · {fmtF(f.fecha)} · {f.dias} días{usadas.has(f.k) ? " · ya conciliada" : ""}{sal.has(f.k) ? " · salió" : ""}</span>
                <span>{fmt(f.valor)}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span>Suma <b>{fmt(sumaM)}</b> · diferencia <b>{fmt(difM)}</b>{sumaM ? ` (${pct((difM / sumaM) * 100)})` : ""}</span>
            <button disabled={busy || !clavesM.length} onClick={() => guardar("conciliado", clavesM)} style={primario}>Confirmar selección</button>
          </div>
        </div>
      )}
      <div><button disabled={busy} onClick={() => guardar("descartado")} style={actionBtn}>Descartar (sin factura asociada)</button></div>
    </div>
  );
}

export default function CruceBanco({ db, user, fechas, showToast }) {
  const fileRef = useRef(null);
  const cache = useRef({}); // promesas de leerCorte por fecha
  const [banco, setBanco] = useState({}), [conc, setConc] = useState({}), [alias, setAlias] = useState({});
  const [fin, setFin] = useState("CARTERA"), [estado, setEstado] = useState("pendiente");
  const [q, setQ] = useState(""), [desde, setDesde] = useState(""), [hasta, setHasta] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [conf, setConf] = useState(null); // { movs, archivo, nuevas }
  const [sinPago, setSinPago] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = [["cartera/banco", setBanco], ["cartera/conciliacion", setConc], ["cartera/alias", setAlias]].map(([r, s]) => subscribeRuta(db, r, s));
    return () => u.forEach((f) => f());
  }, [db]);

  const obtener = (f) => {
    if (!f) return Promise.resolve(null);
    if (!cache.current[f]) cache.current[f] = leerCorte(db, f).catch((e) => { delete cache.current[f]; throw e; });
    return cache.current[f];
  };
  const movs = useMemo(() => Object.entries(banco).map(([id, m]) => ({ id, ...m, c: conc[id] })).sort((a, b) => b.fecha.localeCompare(a.fecha)), [banco, conc]);
  const usadas = useMemo(() => new Set(Object.values(conc).filter((c) => c.estado === "conciliado").flatMap((c) => c.facturas || [])), [conc]);
  const esFin = (m, f) => f === "TODOS" || (f === "SIN" ? !m.fin : m.fin === f);

  const filas = useMemo(() => {
    const s = q.trim().toLowerCase();
    return movs.filter((m) => esFin(m, fin) && (estado === "todos" || estadoDe(m) === estado) && (!desde || m.fecha >= desde) && (!hasta || m.fecha <= hasta) && (!s || [m.tercero, m.desc, m.rc].some((v) => String(v).toLowerCase().includes(s))));
  }, [movs, fin, estado, q, desde, hasta]);

  const cart = movs.filter((m) => m.fin === "CARTERA");
  const suma = (l) => l.reduce((s, m) => s + m.valor, 0);
  const recaudo = suma(cart), concil = suma(cart.filter((m) => estadoDe(m) === "conciliado")), desc = suma(cart.filter((m) => estadoDe(m) === "descartado"));
  const retTotal = cart.filter((m) => m.c?.estado === "conciliado" && (m.c.tipo === "exacto" || m.c.tipo === "retención")).reduce((s, m) => s + m.c.diferencia, 0);

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1048576) { showToast(`"${file.name}" pesa más de ${MAX_MB} MB y no se leyó.`); return; }
    setBusy(true);
    try {
      const nuevos = leerBanco(XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }));
      setConf({ movs: nuevos, archivo: file.name, nuevas: Object.keys(nuevos).filter((id) => !banco[id]).length });
    } catch (err) { showToast(err.message || String(err)); }
    setBusy(false);
  };
  const confirmar = async () => {
    setBusy(true);
    try { await guardarBanco(db, conf.movs); showToast(`Extracto guardado: ${conf.nuevas} movimientos nuevos`); setConf(null); } catch (err) { showToast("No se pudo guardar: " + (err.message || err)); }
    setBusy(false);
  };

  // Salidas entre cortes consecutivos dentro del rango del extracto que ninguna conciliación explica
  const calcularSinPago = async () => {
    if (!movs.length || !fechas.length) return;
    const mn = movs[movs.length - 1].fecha, mx = movs[0].fecha;
    setBusy(true);
    try {
      const filasS = [];
      for (let i = 1; i < fechas.length; i++) {
        if (fechas[i] < mn || fechas[i - 1] > mx) continue;
        const [a, b] = await Promise.all([obtener(fechas[i - 1]), obtener(fechas[i])]);
        for (const f of compararCortes(a, b).salieron) if (!usadas.has(f.k)) filasS.push({ ...f, salio: fechas[i] });
      }
      setSinPago(filasS.sort((x, y) => y.salio.localeCompare(x.salio)));
    } catch (err) { showToast("No se pudo calcular: " + (err.message || err)); }
    setBusy(false);
  };

  const sel = (v, set, ops) => <select value={v} onChange={(e) => set(e.target.value)} style={inp}>{ops.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>;
  return (
    <>
      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onArchivo} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={primario}>{busy ? "Procesando…" : "⬆ Subir extracto"}</button>
        <button onClick={() => XLSX.writeFile(libroConciliacion(XLSX, filas), "Conciliacion_Banco.xlsx")} disabled={!filas.length} style={actionBtn}>⬇ Exportar Excel</button>
      </div>
      {!fechas.length && <div style={{ ...card, color: C.g500, fontSize: 12, marginBottom: 12 }}>Aún no hay cortes de cartera: suba al menos uno para poder sugerir facturas.</div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <Kpi label="Recaudo CARTERA" valor={fmt(recaudo)} sub={`${cart.length} notas crédito`} />
        <Kpi label="Conciliado" valor={fmt(concil)} sub={recaudo ? pct((concil / recaudo) * 100) : "—"} color={C.green} />
        <Kpi label="Pendiente" valor={fmt(recaudo - concil - desc)} sub={`${cart.filter((m) => estadoDe(m) === "pendiente").length} movimientos${desc ? ` · descartado ${fmt(desc)}` : ""}`} color={C.red} />
        <Kpi label="Retención implícita" valor={fmt(retTotal)} sub="suma facturas − pagos (conciliados)" />
      </div>

      <div style={card}>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {sel(estado, setEstado, ESTADOS)}
          {sel(fin, setFin, FINES)}
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} title="Desde" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} title="Hasta" />
          <SearchBar search={q} setSearch={setQ} placeholder="Buscar tercero, descripción, RC..." />
        </div>
        <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>{filas.length} movimientos · total: <b style={{ color: C.navy }}>{fmt(suma(filas))}</b></div>
        <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Fecha", "RC", "Fin", "Tercero", "Descripción", "Valor", "Estado"].map((h) => <th key={h} style={{ ...th, ...(h === "Valor" ? { textAlign: "right" } : {}) }}>{h}</th>)}</tr></thead>
            <tbody>
              {filas.slice(0, 500).map((m) => (
                <FilaMov key={m.id} m={m} abierto={abierto === m.id} onClick={() => setAbierto(abierto === m.id ? null : m.id)}>
                  {fechas.length > 0 && <Detalle m={m} fechas={fechas} obtener={obtener} alias={alias} usadas={usadas} user={user} db={db} showToast={showToast} />}
                </FilaMov>
              ))}
              {!filas.length && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.g500 }}>{movs.length ? "Sin movimientos con esos filtros." : 'Sin movimientos: use "Subir extracto".'}</td></tr>}
            </tbody>
          </table>
        </div>
        {filas.length > 500 && <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>Mostrando 500 de {filas.length}; use filtros o exporte.</div>}
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Facturas que salieron sin pago asociado</div>
          <button onClick={calcularSinPago} disabled={busy || !movs.length || fechas.length < 2} style={actionBtn}>{sinPago ? "Recalcular" : "Calcular"}</button>
        </div>
        <div style={{ fontSize: 11, color: C.g500, margin: "4px 0 6px" }}>Salidas entre cortes consecutivos dentro del rango del extracto que ninguna conciliación incluye (lee los cortes necesarios, puede tardar).</div>
        {sinPago && (
          <>
            <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>{sinPago.length} documentos · total: <b style={{ color: C.navy }}>{fmt(sinPago.reduce((s, f) => s + f.valor, 0))}</b></div>
            <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Salió en corte", "Cliente", "Doc", "Número", "Fecha", "Valor"].map((h) => <th key={h} style={{ ...th, ...(h === "Valor" ? { textAlign: "right" } : {}) }}>{h}</th>)}</tr></thead>
                <tbody>
                  {sinPago.slice(0, 500).map((f) => <tr key={f.salio + f.k}><td style={td}>{fmtF(f.salio)}</td><td style={td}>{f.cli}</td><td style={td}>{f.doc}</td><td style={td}>{f.num}</td><td style={td}>{fmtF(f.fecha)}</td><td style={tdN}>{fmt(f.valor)}</td></tr>)}
                  {!sinPago.length && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: C.g500 }}>Sin registros.</td></tr>}
                </tbody>
              </table>
            </div>
            {sinPago.length > 500 && <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>Mostrando 500 de {sinPago.length}.</div>}
          </>
        )}
      </div>

      {conf && (
        <div style={overlay}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: C.navy }}>Subir extracto</h3>
            <div style={{ fontSize: 13, color: C.g700, lineHeight: 1.7 }}>
              Archivo: <b>{conf.archivo}</b><br />
              Notas crédito: <b>{Object.keys(conf.movs).length}</b> (CARTERA: <b>{Object.values(conf.movs).filter((m) => m.fin === "CARTERA").length}</b>)<br />
              Nuevas: <b>{conf.nuevas}</b> · ya cargadas: <b>{Object.keys(conf.movs).length - conf.nuevas}</b> (se actualizan Tercero/Fin; las conciliaciones no se tocan)
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConf(null)} disabled={busy} style={actionBtn}>Cancelar</button>
              <button onClick={confirmar} disabled={busy} style={primario}>{busy ? "Guardando…" : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilaMov({ m, abierto, onClick, children }) {
  const e = estadoDe(m);
  return (
    <>
      <tr onClick={onClick} style={{ cursor: "pointer", background: abierto ? C.g100 : undefined }}>
        <td style={td}>{fmtF(m.fecha)}</td><td style={td}>{m.rc}</td><td style={td}>{m.fin || "—"}</td><td style={td}>{m.tercero || "—"}</td>
        <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.desc}>{m.desc}</td>
        <td style={tdN}>{fmt(m.valor)}</td>
        <td style={{ ...td, color: e === "conciliado" ? C.green : e === "descartado" ? C.g500 : C.red, fontWeight: 600 }}>{e}</td>
      </tr>
      {abierto && <tr><td colSpan={7} style={{ ...td, background: C.off }}>{children}</td></tr>}
    </>
  );
}
