import { useState, useEffect, useMemo, useRef } from "react";
import { C } from "../constants";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { subscribeContratos, addComentario, setFechaCompromiso, guardarCarga, setCampoFila, eliminarContrato, crearContrato, agregarFila } from "../contratosFirebase";
import { fmt, exportContratosExcel } from "../utils";
import { CAMPOS, leerCuadro, agruparContratos, desdeDb, esOtrosi, esFinalizado, diasEntre, contratoKey, siguienteOrden, filaNueva } from "../contratosExcel";
import SearchBar from "./SearchBar";

const MAX_MB = 20;

const ALARMAS = {
  VENCIDO: { label: "VENCIDO", color: C.red, bg: C.redL },
  D15: { label: "15 DÍAS", color: "#c2410c", bg: "#fff7ed" },
  M3: { label: "3 MESES", color: "#a16207", bg: "#fefce8" },
  VIGENTE: { label: "VIGENTE", color: C.green, bg: C.greenL },
  SIN: { label: "SIN FECHA", color: C.g500, bg: C.g100 },
  FINAL: { label: "FINALIZADO", color: C.g700, bg: C.g100 },
};
const CON_ALARMA = ["VENCIDO", "D15", "M3"];

const FILTROS = [
  ["ALARMA", "Con alarma"], ["TODOS", "Todos"], ["VENCIDO", "Vencidos"],
  ["D15", "≤15 días"], ["M3", "≤3 meses"], ["VIGENTE", "Vigentes"], ["SIN", "Sin fecha"], ["FINAL", "Finalizados"],
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

const labelStyle = { fontSize: 10, fontWeight: 600, color: C.g500, textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 7px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none" };
// Texto de una casilla -> valor guardable (null = vacío, undefined = número inválido). % se escribe en % y se guarda como fracción.
function parseCampo(f, txt) {
  const t = txt.trim();
  if (t === "") return null;
  if (f.tipo !== "number" && f.tipo !== "pct") return t;
  const n = Number(t.replace(",", "."));
  return isNaN(n) ? undefined : f.tipo === "pct" ? n / 100 : n;
}
const pct = (v) => (v === undefined || v === null || v === "" ? "—" : Math.round(Number(v) * 100) + "%");
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

const actionBtn = {
  background: C.white, border: `1px solid ${C.g200}`, fontSize: 11, fontWeight: 600,
  padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy,
};
const COLS = "28px 130px minmax(140px,1fr) minmax(160px,1.4fr) 100px 110px 95px 60px 70px 95px";
const SUBCOLS = "130px minmax(160px,1fr) 110px 95px 95px 120px";

export default function ContratosModule({ user, role, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const fileRef = useRef(null);
  const [raw, setRaw] = useState({ excel: null, notas: null });
  const [loading, setLoading] = useState(configured);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("ALARMA");
  const [collapsed, setCollapsed] = useState({});
  const [open, setOpen] = useState(null);
  const [rowSel, setRowSel] = useState(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(null);
  const [sel, setSel] = useState({});
  const [modal, setModal] = useState(null); // { titulo, lineas, avisos, carga? }
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState(null); // { hoja, vals: {key: texto} }
  const [tipoNueva, setTipoNueva] = useState("OTROSÍ");

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeContratos(dbRef.current, (d) => { setRaw(d); setLoading(false); });
  }, [configured]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const contratos = useMemo(() => {
    const notas = raw.notas || {};
    return Object.entries(raw.excel?.contratos || {}).map(([key, c]) => {
      const d = desdeDb(key, c);
      const dias = diasPara(d.fechaFinEfectiva);
      return { ...d, nota: notas[key] || {}, dias, alarma: esFinalizado(d.estadoEfectivo) ? "FINAL" : alarmaDe(dias), otrosies: d.filas.filter(esOtrosi).length };
    });
  }, [raw]);

  const counts = useMemo(() => {
    const n = { TODOS: contratos.length, ALARMA: 0, VENCIDO: 0, D15: 0, M3: 0, VIGENTE: 0, SIN: 0, FINAL: 0 };
    contratos.forEach((c) => { n[c.alarma]++; if (CON_ALARMA.includes(c.alarma)) n.ALARMA++; });
    return n;
  }, [contratos]);

  const grupos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const g = {};
    contratos
      .filter((c) => filtro === "TODOS" || (filtro === "ALARMA" ? CON_ALARMA.includes(c.alarma) : c.alarma === filtro))
      .filter((c) => !q || [c.contrato, c.hoja, c.base.objeto, c.base.proyecto, c.base.entidad, c.base.nit].some((v) => String(v || "").toLowerCase().includes(q)))
      .forEach((c) => { (g[c.hoja] ||= []).push(c); });
    return Object.entries(g)
      .map(([nombre, rows]) => ({ nombre, rows: rows.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity)) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [contratos, search, filtro]);

  const meta = raw.excel?._meta;
  const visibles = useMemo(() => grupos.flatMap((g) => g.rows), [grupos]);
  const seleccionados = useMemo(() => contratos.filter((c) => sel[c.key]), [contratos, sel]);
  const nSel = seleccionados.length;

  const toggleKeys = (keys, on) => setSel((s) => { const n = { ...s }; keys.forEach((k) => { if (on) n[k] = true; else delete n[k]; }); return n; });

  // Guarda un campo de una fila al salir de la casilla; vacío borra el valor. Porcentaje se escribe en % y se guarda como fracción.
  const guardar = (c, idx, f, txt) => {
    const cur = c.filas[idx][f.key];
    const val = parseCampo(f, txt);
    if (val === undefined || val === (cur ?? null)) return;
    setCampoFila(dbRef.current, c.key, idx, f.key, val);
  };

  const hojas = useMemo(() => [...new Set(contratos.map((c) => c.hoja))].sort((a, b) => a.localeCompare(b)), [contratos]);

  // Al elegir una hoja existente, precarga ENCARGADO/ENTIDAD/NIT del primer contrato de esa hoja (solo casillas vacías).
  const cambiaNuevo = (hoja, vals) => {
    const prev = contratos.filter((c) => c.hoja === hoja).sort((a, b) => a.orden - b.orden)[0];
    const v = { ...vals };
    if (prev) ["encargado", "entidad", "nit"].forEach((k) => { if (!v[k] && prev.base[k]) v[k] = String(prev.base[k]); });
    setNuevo({ hoja, vals: v });
  };

  const guardarNuevo = async () => {
    const hoja = nuevo.hoja.trim();
    const fila = { tipo: "---" };
    for (const f of CAMPOS) {
      if (f.tipo === "calc" || f.key === "tipo") continue;
      const val = parseCampo(f, nuevo.vals[f.key] || "");
      if (val === undefined) return showToast(`Valor inválido en ${f.h}`);
      if (val !== null) fila[f.key] = val;
    }
    if (!hoja || (!fila.contrato && !fila.objeto)) return showToast("Falta la hoja y el CONTRATO (u OBJETO si no hay número)");
    const key = contratoKey(hoja, fila);
    const existentes = raw.excel?.contratos || {};
    if (existentes[key]) return showToast(`El contrato ya existe en ${hoja}; ábrelo y agrega un otrosí`);
    setBusy(true);
    try {
      const orden = siguienteOrden(Object.values(existentes), hoja);
      await crearContrato(dbRef.current, key, { hoja, contrato: fila.contrato || "", orden, actualizadoAt: new Date().toISOString(), actualizadoPor: user.name, archivo: "portal", filas: [fila] });
      setNuevo(null);
      setFiltro("TODOS"); setSearch(""); setCollapsed((s) => ({ ...s, [hoja]: false }));
      setOpen(key); setRowSel(null);
      showToast("Contrato creado");
    } catch (err) {
      showToast("No se pudo guardar: " + (err.message || err));
    }
    setBusy(false);
  };

  const nuevaFila = async (c) => {
    const rawF = raw.excel?.contratos?.[c.key]?.filas;
    const idx = Array.isArray(rawF) ? rawF.length : Math.max(-1, ...Object.keys(rawF || {}).map(Number)) + 1;
    try {
      await agregarFila(dbRef.current, c.key, idx, filaNueva(c.base, c.filas, tipoNueva === "LIQUIDACIÓN"));
      setRowSel(c.filas.length); // la fila nueva queda al final (desdeDb descarta huecos)
    } catch (err) {
      showToast("No se pudo agregar: " + (err.message || err));
    }
  };

  const comentar =(c) => {
    if (!draft.trim()) return;
    addComentario(dbRef.current, c.key, { texto: draft.trim(), autor: user.name, at: new Date().toISOString() });
    setDraft("");
  };

  const borrar = (c) => {
    if (!window.confirm(`¿Eliminar el contrato ${c.contrato || "(sin número)"} de ${c.hoja} con sus ${c.filas.length} fila(s)? No se puede deshacer.`)) return;
    eliminarContrato(dbRef.current, c.key);
    setOpen(null);
    showToast("Contrato eliminado");
  };

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setModal({
        titulo: "Archivo demasiado grande",
        lineas: [`"${file.name}" pesa ${(file.size / 1048576).toFixed(0)} MB (máximo ${MAX_MB} MB) y no se leyó.`,
          "Casi siempre es por filas vacías con formato. En Excel, en cada hoja: seleccione las filas vacías debajo de los datos, clic derecho > Eliminar, y guarde. El archivo debería quedar en 1–3 MB."],
      });
      return;
    }
    setBusy(true);
    try {
      const { filas, avisos } = leerCuadro(await file.arrayBuffer());
      const cs = agruparContratos(filas);
      const existentes = raw.excel?.contratos || {};
      const act = cs.filter((c) => existentes[c.key]).length;
      const noTocan = Object.keys(existentes).length - act;
      setModal({
        titulo: "Resumen de la carga",
        lineas: [`${cs.length} contratos en el archivo: ${cs.length - act} nuevos · ${act} se actualizarán · ${noTocan} del portal no se tocan`,
          `${filas.length} filas leídas. Los contratos del archivo reemplazan los del portal; comentarios y fecha de compromiso se conservan.`],
        avisos,
        carga: cs.length ? { cs, archivo: file.name, nuevos: cs.length - act, actualizados: act, existentes } : null,
      });
    } catch (err) {
      setModal({ titulo: "No se pudo leer el archivo", lineas: [String(err.message || err)] });
    }
    setBusy(false);
  };

  const confirmarCarga = async () => {
    const { cs, archivo, nuevos, actualizados, existentes } = modal.carga;
    setModal(null);
    setBusy(true);
    try {
      // Un contrato que ya existe conserva su `orden` (el archivo puede ser un export parcial).
      const lista = cs.map((c) => ({ ...c, orden: existentes[c.key]?.orden ?? c.orden }));
      await guardarCarga(dbRef.current, lista, { at: new Date().toISOString(), autor: user.name, archivo, nuevos, actualizados });
      showToast(`Carga lista: ${nuevos} nuevos, ${actualizados} actualizados`);
    } catch (err) {
      showToast("No se pudo guardar: " + (err.message || err));
    }
    setBusy(false);
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

  const calc = (f, fila, dias) => {
    const p = diasEntre(fila.fechaInicio, fila.fechaFin);
    if (p === null) return "—";
    if (f.key === "dias") return p;
    if (f.key === "meses") return (p / 30).toFixed(1);
    return diasPara(fila.fechaFin) ?? dias ?? "—";
  };

  const renderForm = (c, idx) => {
    const fila = c.filas[idx];
    if (!fila) return null;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, margin: "8px 0 12px", padding: 10, background: C.white, border: `1px solid ${C.g200}`, borderRadius: 4 }}>
        {CAMPOS.map((f) => {
          if (f.tipo === "calc") {
            return <div key={f.key}><div style={labelStyle}>{f.h} (calculado)</div><div style={{ padding: "5px 0", color: C.g900 }}>{calc(f, fila)}</div></div>;
          }
          const v = fila[f.key];
          const shown = f.tipo === "pct" && v !== undefined && v !== null ? Math.round(v * 10000) / 100 : v;
          return (
            <div key={f.key} style={{ gridColumn: f.key === "objeto" ? "1 / -1" : undefined }}>
              <div style={labelStyle}>{f.h.replace(" mm/aaaa", "")}{f.tipo === "pct" ? " (%)" : ""}</div>
              <input key={c.key + idx + f.key + String(v)} defaultValue={shown ?? ""}
                type={f.tipo === "date" ? "date" : f.tipo === "text" ? "text" : "number"} step="any"
                onBlur={(e) => guardar(c, idx, f, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                style={inputStyle} />
            </div>
          );
        })}
      </div>
    );
  };

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
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase" }}>Contratos</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.navy, margin: "2px 0 0" }}>Vencimientos de Contratos</h1>
            <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>
              Última carga: {meta ? `${fmtAt(meta.at)} · ${meta.autor || "—"} · ${meta.archivo || "—"}` : "—"}
            </div>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBar search={search} setSearch={setSearch} placeholder="Buscar contrato, objeto, proyecto, NIT..." />
            <input ref={fileRef} type="file" accept=".xlsx" onChange={onArchivo} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy || !configured}
              style={{ ...actionBtn, background: busy ? C.g100 : C.accent, color: C.white, borderColor: C.accent }}>
              {busy ? "Procesando…" : "⬆ Subir Excel"}
            </button>
            <button onClick={() => setNuevo({ hoja: "", vals: {} })} disabled={busy || !configured} style={actionBtn}>＋ Nuevo contrato</button>
            <button onClick={() => exportContratosExcel(nSel ? seleccionados : visibles)} disabled={!(nSel || visibles.length)} style={actionBtn}>
              {nSel ? `⬇ Exportar (${nSel})` : "⬇ Exportar Excel"}
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.g500, textTransform: "uppercase", marginRight: 4 }}>Filtrar:</span>
          {FILTROS.map(([k, l]) => (
            <button key={k} style={filterBtn(k)} onClick={() => setFiltro(k)}>{l} ({counts[k]})</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <button style={actionBtn} onClick={() => toggleKeys(visibles.map((c) => c.key), true)} disabled={!visibles.length}>Seleccionar visibles</button>
          <button style={actionBtn} onClick={() => setSel({})} disabled={!nSel}>Limpiar</button>
          <span style={{ fontSize: 11, color: C.g500 }}>{nSel ? `${nSel} seleccionados: el botón exporta solo esos` : "Sin selección: el botón exporta lo visible"}</span>
        </div>

        {!configured ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>Firebase no está configurado: no hay contratos para mostrar.</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}><div className="spinner" />Cargando contratos…</div>
        ) : grupos.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.g500, fontSize: 12 }}>
            {contratos.length ? "No hay contratos para este filtro." : "Aún no hay contratos: use \"Subir Excel\" con el Cuadro de Experiencia."}
          </div>
        ) : (
          grupos.map((g) => {
            const isCol = collapsed[g.nombre];
            const gc = {};
            g.rows.forEach((r) => { gc[r.alarma] = (gc[r.alarma] || 0) + 1; });
            const todos = g.rows.every((r) => sel[r.key]);
            return (
              <div key={g.nombre} style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 6, marginBottom: 12, overflowX: "auto" }}>
                <div onClick={() => setCollapsed((s) => ({ ...s, [g.nombre]: !s[g.nombre] }))}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: C.g100 }}>
                  <input type="checkbox" checked={todos} title="Seleccionar todos los contratos del grupo"
                    onClick={(e) => e.stopPropagation()} onChange={(e) => toggleKeys(g.rows.map((r) => r.key), e.target.checked)} />
                  <span style={{ fontSize: 11, color: C.g500 }}>{isCol ? "▶" : "▼"}</span>
                  <strong style={{ fontSize: 13, color: C.navy }}>{g.nombre}</strong>
                  <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{g.rows[0].base.entidad}</span>
                  <span style={{ fontSize: 11, color: C.g500 }}>{g.rows.length} contratos</span>
                  <span style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    {CON_ALARMA.filter((a) => gc[a]).map((a) => (
                      <span key={a} style={{ fontSize: 11, color: C.g700 }}>{gc[a]} {badge(a)}</span>
                    ))}
                  </span>
                </div>
                {!isCol && (
                  <div style={{ minWidth: 980 }}>
                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "6px 14px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.g200}` }}>
                      <span /><span>Contrato</span><span>Proyecto</span><span>Objeto</span><span>Estado</span><span>Valor</span><span>Fecha fin</span><span>Días</span><span>Otrosíes</span><span>Alarma</span>
                    </div>
                    {g.rows.map((c) => {
                      const isOpen = open === c.key;
                      const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                      return (
                        <div key={c.key} style={{ borderBottom: `1px solid ${C.g100}` }}>
                          <div onClick={() => { setOpen(isOpen ? null : c.key); setRowSel(null); setDraft(""); }}
                            style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 14px", fontSize: 12, color: C.g900, cursor: "pointer", alignItems: "center", background: isOpen ? C.blueL : "transparent" }}>
                            <input type="checkbox" checked={!!sel[c.key]} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleKeys([c.key], e.target.checked)} />
                            <span style={ellipsis}>{c.contrato || "—"}</span>
                            <span style={{ fontWeight: 600, ...ellipsis }} title={c.base.proyecto}>{c.base.proyecto || "—"}</span>
                            <span style={ellipsis} title={c.base.objeto}>{c.base.objeto || "—"}</span>
                            <span style={ellipsis}>{c.estadoEfectivo || "—"}</span>
                            <span>{c.base.valor != null ? fmt(c.base.valor) : "—"}</span>
                            <span>{c.fechaFinEfectiva || "—"}</span>
                            <span style={{ color: ALARMAS[c.alarma].color, fontWeight: 700 }}>{c.dias ?? "—"}</span>
                            <span>{c.otrosies}</span>
                            <span>{badge(c.alarma)}</span>
                          </div>
                          {isOpen && (
                            <div style={{ padding: "12px 14px 16px", background: C.off, fontSize: 12 }}>
                              <div style={{ border: `1px solid ${C.g200}`, borderRadius: 4, background: C.white, overflowX: "auto" }}>
                                <div style={{ minWidth: 700 }}>
                                  <div style={{ display: "grid", gridTemplateColumns: SUBCOLS, gap: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", borderBottom: `1px solid ${C.g200}` }}>
                                    <span>Tipo</span><span>Objeto</span><span>Valor</span><span>Inicio</span><span>Fin</span><span>Estado</span>
                                  </div>
                                  {c.filas.map((f, i) => (
                                    <div key={i} onClick={() => setRowSel(rowSel === i ? null : i)}
                                      style={{ display: "grid", gridTemplateColumns: SUBCOLS, gap: 8, padding: "6px 10px", cursor: "pointer", alignItems: "center", background: rowSel === i ? C.blueL : "transparent", borderBottom: `1px solid ${C.g100}` }}>
                                      <span>{f.tipo && f.tipo !== "---" ? f.tipo : "Contrato"}</span>
                                      <span style={ellipsis} title={f.objeto}>{f.objeto || "—"}</span>
                                      <span>{f.valor != null ? fmt(f.valor) : "—"}</span>
                                      <span>{f.fechaInicio || "—"}</span>
                                      <span>{f.fechaFin || "—"}</span>
                                      <span>{f.estado || "—"}{f.pct != null ? ` · ${pct(f.pct)}` : ""}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                                <button onClick={() => nuevaFila(c)} style={actionBtn}>＋ Agregar otrosí / liquidación</button>
                                <select value={tipoNueva} onChange={(e) => setTipoNueva(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                                  <option>OTROSÍ</option><option>LIQUIDACIÓN</option>
                                </select>
                              </div>
                              {rowSel !== null && renderForm(c, rowSel)}
                              <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase" }}>Fecha de compromiso:</span>
                                <input type="date" value={c.nota.fechaCompromiso || ""}
                                  onChange={(e) => setFechaCompromiso(dbRef.current, c.key, e.target.value)}
                                  style={{ fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none" }} />
                                <button onClick={() => borrar(c)} style={{ ...actionBtn, marginLeft: "auto", color: C.red, borderColor: C.red }}>Eliminar contrato</button>
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

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>{modal.titulo}</h2>
            {modal.lineas.map((l, i) => <p key={i} style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>{l}</p>)}
            {modal.avisos?.length > 0 && (
              <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: "6px 10px", margin: "8px 0", maxHeight: 160, overflowY: "auto", fontSize: 11, color: C.g700 }}>
                <strong>Avisos ({modal.avisos.length})</strong>
                {modal.avisos.map((a, i) => <div key={i}>• {a}</div>)}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setModal(null)}>{modal.carga ? "Cancelar" : "Cerrar"}</button>
              {modal.carga && <button style={{ ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent }} onClick={confirmarCarga}>Actualizar</button>}
            </div>
          </div>
        </div>
      )}

      {nuevo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: C.white, borderRadius: 8, padding: 20, maxWidth: 820, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Nuevo contrato</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              <div>
                <div style={labelStyle}>Hoja / constructora *</div>
                <input list="hojas-contratos" value={nuevo.hoja} onChange={(e) => cambiaNuevo(e.target.value, nuevo.vals)} style={inputStyle} />
                <datalist id="hojas-contratos">{hojas.map((h) => <option key={h} value={h} />)}</datalist>
              </div>
              {CAMPOS.filter((f) => f.tipo !== "calc" && f.key !== "tipo").map((f) => (
                <div key={f.key} style={{ gridColumn: f.key === "objeto" ? "1 / -1" : undefined }}>
                  <div style={labelStyle}>{f.h.replace(" mm/aaaa", "")}{f.tipo === "pct" ? " (%)" : ""}{f.key === "contrato" ? " *" : ""}</div>
                  <input value={nuevo.vals[f.key] || ""} onChange={(e) => setNuevo({ ...nuevo, vals: { ...nuevo.vals, [f.key]: e.target.value } })}
                    type={f.tipo === "date" ? "date" : f.tipo === "text" ? "text" : "number"} step="any" style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setNuevo(null)}>Cancelar</button>
              <button style={{ ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent }} disabled={busy} onClick={guardarNuevo}>Crear</button>
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
