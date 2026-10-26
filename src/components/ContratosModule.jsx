import { useState, useEffect, useMemo, useRef } from "react";
import { C } from "../constants";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import { subscribeContratos, subscribePermisos, subscribeHistorial, aplicarCambios, nuevoId, copiarProdAPrueba, MODO_PRUEBA } from "../contratosFirebase";
import { fmt, exportContratosExcel } from "../utils";
import { CAMPOS, ESTADOS, MODIFICA, norm, leerCuadro, ubicarHojas, hojasConocidas, agruparContratos, aplicarAlias, desdeDb, esBase, esOtrosi, esFinalizado, diasEntre, contratoKey, siguienteOrden, filaNueva, sugerencias, permisosContratos, planEditarCampo, planCrearContrato, planAgregarFila, planEliminarContrato, planEliminarFila, planEliminarHoja, planUnir, planComentario, planFecha, planIgnorarSug, planCarga } from "../contratosExcel";
import SearchBar from "./SearchBar";
import HistorialContratos from "./HistorialContratos";

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
// Texto de una casilla -> valor guardable (null = vacío, undefined = número inválido).
function parseCampo(f, txt) {
  const t = txt.trim();
  if (t === "") return null;
  if (f.tipo !== "number") return t;
  const n = Number(t.replace(",", "."));
  return isNaN(n) ? undefined : n;
}
// Estado de la obra: solo los valores de ESTADOS; uno distinto (vacío, número...) se ve como "(actual: X)" hasta que alguien lo cambie.
// "EN EJECUCION" sin tilde cuenta como "EN EJECUCIÓN".
const EstadoSelect = ({ value, onChange, disabled }) => {
  const v = ESTADOS.find((e) => norm(e) === norm(value ?? "")) ?? value ?? "";
  return (
    <select value={v} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="" />
      {v !== "" && !ESTADOS.includes(v) && <option value={v} style={{ color: C.g500 }}>(actual: {String(v)})</option>}
      {ESTADOS.map((e) => <option key={e}>{e}</option>)}
    </select>
  );
};
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const dialog = { background: C.white, borderRadius: 8, padding: 20, width: "100%", maxHeight: "90vh", overflowY: "auto" };
const coincide = (c, q) => !q || [c.contrato, c.hoja, c.base.objeto, c.base.proyecto, c.base.entidad, c.base.nit].some((v) => String(v || "").toLowerCase().includes(q));
const etiqueta = (c) => `${c.hoja} · ${c.contrato || "(sin número)"}`;
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

const primario = { background: C.accent, color: C.white, borderColor: C.accent };
const actionBtn = {
  background: C.white, border: `1px solid ${C.g200}`, fontSize: 11, fontWeight: 600,
  padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy,
};
const COLS = "130px minmax(140px,1fr) minmax(160px,3fr) 100px 110px 95px 60px 70px 95px";
const SUBCOLS = "130px minmax(160px,1fr) 110px 95px 95px 120px 130px";

export default function ContratosModule({ user, onBack }) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const fileRef = useRef(null);
  const [raw, setRaw] = useState({ excel: null, notas: null, alias: null });
  const [loading, setLoading] = useState(configured);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("ALARMA");
  const [collapsed, setCollapsed] = useState({});
  const [open, setOpen] = useState(null);
  const [rowSel, setRowSel] = useState(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(null);
  const [exp, setExp] = useState(null); // { q, sel:{key:true}, formato, contenido }
  const [unir, setUnir] = useState(null); // { src, idx|null, q, dst }
  const [sugOpen, setSugOpen] = useState(false);
  const [modal, setModal] = useState(null); // { titulo, lineas, avisos, carga? }
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState(null); // { hoja, vals: {key: texto} }
  const [tipoNueva, setTipoNueva] = useState("OTROSÍ");
  const [permReg, setPermReg] = useState(null);
  const [permOk, setPermOk] = useState(false);
  const [delHoja, setDelHoja] = useState(null); // { nombre, n, texto }
  const [histOpen, setHistOpen] = useState(false);
  const [histRecent, setHistRecent] = useState([]);
  const esAdmin = user.role === "admin";
  // Hasta que llega el registro de permisos solo el admin edita (evita un parpadeo con los permisos por defecto).
  const perm = useMemo(() => (permOk || esAdmin ? permisosContratos(user, permReg) : permisosContratos({}, null)), [permOk, esAdmin, user, permReg]);

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    const u1 = subscribeContratos(dbRef.current, (d) => { setRaw(d); setLoading(false); });
    const u2 = subscribePermisos(dbRef.current, user.id, (v) => { setPermReg(v); setPermOk(true); });
    // ponytail: el historial por contrato sale de las últimas 200 entradas cargadas; con más volumen, consultar por contratoKey (índice) en RTDB.
    const u3 = esAdmin ? subscribeHistorial(dbRef.current, 200, setHistRecent) : () => {};
    return () => { u1(); u2(); u3(); };
  }, [configured, user.id, esAdmin]);

  const ctx = () => ({ usuario: user.name, nuevoId: () => nuevoId(dbRef.current) });
  const run = (upd) => aplicarCambios(dbRef.current, upd);
  const intenta = (fn, msg) => Promise.resolve().then(fn).then(() => msg && showToast(msg)).catch((err) => showToast("No se pudo guardar: " + (err.message || err)));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const contratos = useMemo(() => {
    const notas = raw.notas || {};
    return Object.entries(raw.excel?.contratos || {}).map(([key, c]) => {
      const d = desdeDb(key, c);
      const dias = diasPara(d.fechaFinVigente);
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
      .filter((c) => coincide(c, q))
      .forEach((c) => { (g[c.hoja] ||= []).push(c); });
    return Object.entries(g)
      .map(([nombre, rows]) => ({ nombre, rows: rows.sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity)) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [contratos, search, filtro]);

  const meta = raw.excel?._meta;
  const visibles = useMemo(() => grupos.flatMap((g) => g.rows), [grupos]);
  const porKey = useMemo(() => new Map(contratos.map((c) => [c.key, c])), [contratos]);
  // Una sugerencia une dos contratos: hay que poder editar ambas hojas.
  const sugs = useMemo(() => sugerencias(contratos).filter((s) => !raw.notas?.[s.key]?.ignorarSugerencia && perm.puedeEditarHoja(porKey.get(s.key).hoja) && perm.puedeEditarHoja(porKey.get(s.destino).hoja)), [contratos, raw.notas, perm, porKey]);

  // Exportar: lista de contratos agrupada por constructora, con búsqueda.
  const expGrupos = useMemo(() => {
    if (!exp) return [];
    const q = exp.q.trim().toLowerCase(), g = {};
    contratos.filter((c) => coincide(c, q)).sort((a, b) => a.orden - b.orden).forEach((c) => { (g[c.hoja] ||= []).push(c); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [exp?.q, contratos]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSelExp = (keys, on) => setExp((e) => { const s = { ...e.sel }; keys.forEach((k) => { if (on) s[k] = true; else delete s[k]; }); return { ...e, sel: s }; });
  const nExp = exp ? contratos.filter((c) => exp.sel[c.key]).length : 0;
  const exportar = () => {
    exportContratosExcel(contratos.filter((c) => exp.sel[c.key]), { formato: exp.formato, contenido: exp.contenido });
    setExp(null);
  };

  // Unir contratos / mover una fila: un solo update multi-path (filas, alias, comentarios).
  const ejecutarUnir = async (src, dst, idx, accion) => {
    if (!perm.puedeEditarHoja(porKey.get(src).hoja) || !perm.puedeEditarHoja(porKey.get(dst).hoja)) return showToast("No tienes permiso en las dos constructoras");
    setBusy(true);
    try {
      const todo = idx == null || porKey.get(src).filas.length < 2;
      await run(planUnir(raw.excel.contratos, raw.notas || {}, src, dst, idx, ctx(), accion));
      setUnir(null); setSugOpen(false); setRowSel(null);
      setOpen(dst);
      showToast(todo ? "Contratos unidos" : "Fila movida");
    } catch (err) {
      showToast("No se pudo guardar: " + (err.message || err));
    }
    setBusy(false);
  };
  const unirSugerido = (s) => {
    const a = porKey.get(s.key), b = porKey.get(s.destino);
    if (window.confirm(`¿Unir ${etiqueta(a)} con ${etiqueta(b)}? Sus filas pasan a este último y el primero desaparece.`)) ejecutarUnir(s.key, s.destino, null, "aplicar sugerencia");
  };

  // Guarda un campo de una fila al salir de la casilla; vacío borra el valor.
  const guardar = (c, idx, f, txt) => {
    const cur = c.filas[idx][f.key];
    const val = parseCampo(f, txt);
    if (val === undefined || val === (cur ?? null)) return;
    intenta(() => run(planEditarCampo(c, idx, f.key, cur, val, ctx())));
  };

  const hojas = useMemo(() => [...new Set(contratos.map((c) => c.hoja))].sort((a, b) => a.localeCompare(b)), [contratos]);
  const hojasEditables = useMemo(() => hojas.filter(perm.puedeEditarHoja), [hojas, perm]);

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
    if (!perm.puedeEditarHoja(hoja) || (!perm.editarTodo && !hojas.some((h) => norm(h) === norm(hoja)))) return showToast("No tienes permiso para crear contratos en esa constructora");
    const key = contratoKey(hoja, fila);
    const existentes = raw.excel?.contratos || {};
    if (existentes[key]) return showToast(`El contrato ya existe en ${hoja}; ábrelo y agrega un otrosí`);
    setBusy(true);
    try {
      const orden = siguienteOrden(Object.values(existentes), hoja);
      await run(planCrearContrato(key, { hoja, contrato: fila.contrato || "", orden, actualizadoAt: new Date().toISOString(), actualizadoPor: user.name, archivo: "portal", filas: [fila] }, ctx()));
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
      await run(planAgregarFila(c, idx, filaNueva(c.base, c.filas, tipoNueva === "LIQUIDACIÓN"), ctx()));
      setRowSel(c.filas.length); // la fila nueva queda al final (desdeDb descarta huecos)
    } catch (err) {
      showToast("No se pudo agregar: " + (err.message || err));
    }
  };

  const comentar = (c) => {
    if (!draft.trim()) return;
    intenta(() => run(planComentario(c, { texto: draft.trim(), autor: user.name, at: new Date().toISOString() }, ctx())));
    setDraft("");
  };

  const borrar = (c) => {
    if (!window.confirm(`¿Eliminar el contrato ${c.contrato || "(sin número)"} de ${c.hoja} con sus ${c.filas.length} fila(s)? No se puede deshacer.`)) return;
    intenta(() => run(planEliminarContrato(raw.excel.contratos, c.key, ctx())), "Contrato eliminado");
    setOpen(null);
  };

  const borrarFila = (c, i) => {
    const f = c.filas[i], nombre = f.tipo && f.tipo !== "---" ? f.tipo : "el contrato base";
    const unica = c.filas.length < 2;
    if (!window.confirm(`¿Eliminar ${nombre} del contrato ${c.contrato || "(sin número)"}?${unica ? " Es la única fila: se elimina el contrato completo." : ""} No se puede deshacer.`)) return;
    intenta(() => run(planEliminarFila(raw.excel.contratos, c.key, i, ctx())), unica ? "Contrato eliminado" : "Fila eliminada");
    setRowSel(null);
    if (unica) setOpen(null);
  };

  const borrarHoja = async () => {
    setBusy(true);
    await intenta(() => run(planEliminarHoja(raw.excel.contratos, delHoja.nombre, ctx())), "Constructora eliminada");
    setDelHoja(null); setOpen(null);
    setBusy(false);
  };

  const copiarPrueba = async () => {
    if (!window.confirm("Se reemplazarán los datos de prueba (pruebas/contratosExcel y pruebas/contratosAlias) con una copia de producción. Producción solo se lee. ¿Continuar?")) return;
    setBusy(true);
    await intenta(() => copiarProdAPrueba(dbRef.current), "Datos de producción copiados a prueba");
    setBusy(false);
  };

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !perm.editarTodo) return;
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
      const { filas: leidas, avisos, sinHoja } = leerCuadro(await file.arrayBuffer());
      const existentes = raw.excel?.contratos || {};
      const lista = Object.entries(existentes).map(([key, c]) => ({ key, hoja: c.hoja, contrato: c.contrato }));
      // Hojas del archivo sin columna HOJA que no son una constructora conocida (p. ej. "Contratos" tras borrar HOJA en Excel).
      const conocidas = hojasConocidas(lista);
      const raras = sinHoja.filter((h) => !conocidas.has(norm(h)));
      const u = ubicarHojas(leidas, lista);
      const sinResolver = u.filas.filter((f) => f._sinHoja).length;
      const armar = (filas) => {
        const { cs, unidos } = aplicarAlias(agruparContratos(filas), raw.alias || {}, existentes);
        const act = cs.filter((c) => existentes[c.key]).length;
        const hojasExist = new Set(Object.values(existentes).map((c) => norm(c.hoja)));
        const porHoja = {};
        cs.forEach((c) => { if (!hojasExist.has(norm(c.hoja))) porHoja[c.hoja] = (porHoja[c.hoja] || 0) + 1; });
        const masivas = Object.entries(porHoja).filter(([, n]) => n > 50);
        return {
          filas: filas.length, unidos, noTocan: Object.keys(existentes).length - act, masivas,
          carga: cs.length ? { cs, archivo: file.name, nuevos: cs.length - act, actualizados: act, existentes } : null,
        };
      };
      const solo = armar(u.filas.filter((f) => !f._sinHoja)), todo = armar(u.filas);
      setModal({
        titulo: "Resumen de la carga", avisos, modo: "solo", solo, todo,
        sinHoja: raras.length ? { hoja: raras.join(", "), ubicadas: u.ubicadas, ambiguas: u.ambiguas, sinCoincidencia: u.sinCoincidencia, sinResolver } : null,
      });
    } catch (err) {
      setModal({ titulo: "No se pudo leer el archivo", lineas: [String(err.message || err)] });
    }
    setBusy(false);
  };

  const cargaSel = modal && modal.solo ? (modal.sinHoja ? modal[modal.modo] : modal.todo) : null;
  const confirmarCarga = async () => {
    const { cs, archivo, nuevos, actualizados, existentes } = cargaSel.carga;
    setModal(null);
    setBusy(true);
    try {
      // Un contrato que ya existe conserva su `orden` (el archivo puede ser un export parcial).
      const lista = cs.map((c) => ({ ...c, orden: existentes[c.key]?.orden ?? c.orden }));
      await run(planCarga(lista, { at: new Date().toISOString(), autor: user.name, archivo, nuevos, actualizados }, ctx()));
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
    const ro = !perm.puedeEditarHoja(c.hoja);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, margin: "8px 0 12px", padding: 10, background: C.white, border: `1px solid ${C.g200}`, borderRadius: 4 }}>
        {CAMPOS.map((f) => {
          if (f.tipo === "calc") {
            return <div key={f.key}><div style={labelStyle}>{f.h} (calculado)</div><div style={{ padding: "5px 0", color: C.g900 }}>{calc(f, fila)}</div></div>;
          }
          const v = fila[f.key];
          return (
            <div key={f.key} style={{ gridColumn: f.key === "objeto" ? "1 / -1" : undefined }}>
              <div style={labelStyle}>{f.h.replace(" mm/aaaa", "")}</div>
              {f.key === "estado" ? <EstadoSelect value={v} disabled={ro} onChange={(x) => guardar(c, idx, f, x)} /> : (
                <input key={c.key + idx + f.key + String(v)} defaultValue={v ?? ""}
                  type={f.tipo === "date" ? "date" : f.tipo === "text" ? "text" : "number"} step="any"
                  disabled={ro} onBlur={(e) => guardar(c, idx, f, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  style={inputStyle} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif", paddingTop: MODO_PRUEBA ? 24 : 0 }}>
      {MODO_PRUEBA && <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 24, lineHeight: "24px", background: "#facc15", color: "#422006", fontSize: 12, fontWeight: 700, textAlign: "center", zIndex: 1300 }}>MODO PRUEBA — los cambios no afectan producción</div>}
      <header className="app-header" style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
            </div>
            <span className="brand-title" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>PORTAL CORPORATIVO</span>
            <div style={{ background: C.accent, color: C.navy, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>{user.role}</div>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>👤 {user.name}</span>
            {perm.soloLectura && permOk && <span style={{ background: "rgba(255,255,255,.15)", color: C.white, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3 }}>Solo lectura</span>}
          </div>
        </div>
      </header>

      <div style={{ padding: "20px clamp(16px, 2vw, 24px)" }}>
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
            {perm.editarTodo && <>
              <input ref={fileRef} type="file" accept=".xlsx" onChange={onArchivo} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} disabled={busy || !configured}
                style={{ ...actionBtn, background: busy ? C.g100 : C.accent, color: C.white, borderColor: C.accent }}>
                {busy ? "Procesando…" : "⬆ Subir Excel"}
              </button>
            </>}
            {(perm.editarTodo || hojasEditables.length > 0) && <button onClick={() => setNuevo({ hoja: "", vals: {} })} disabled={busy || !configured} style={actionBtn}>＋ Nuevo contrato</button>}
            {esAdmin && <button onClick={() => setHistOpen(true)} style={actionBtn}>Historial</button>}
            {esAdmin && MODO_PRUEBA && <button onClick={copiarPrueba} disabled={busy || !configured} style={{ ...actionBtn, background: "#fef9c3", borderColor: "#facc15" }}>Copiar datos de producción a prueba</button>}
            <button onClick={() => setExp({ q: "", sel: Object.fromEntries(visibles.map((c) => [c.key, true])), formato: "hoja", contenido: "completo" })} disabled={!contratos.length} style={actionBtn}>
              ⬇ Exportar Excel
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.g500, textTransform: "uppercase", marginRight: 4 }}>Filtrar:</span>
          {FILTROS.map(([k, l]) => (
            <button key={k} style={filterBtn(k)} onClick={() => setFiltro(k)}>{l} ({counts[k]})</button>
          ))}
          {sugs.length > 0 && (
            <button style={{ ...filterBtn(""), marginLeft: 8, color: "#a16207", background: "#fefce8", boxShadow: "inset 0 0 0 1px #a16207" }} onClick={() => setSugOpen(true)}>
              Sugerencias de corrección ({sugs.length})
            </button>
          )}
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
            return (
              <div key={g.nombre} style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 6, marginBottom: 12, overflowX: "auto" }}>
                <div onClick={() => setCollapsed((s) => ({ ...s, [g.nombre]: !s[g.nombre] }))}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: C.g100 }}>
                  <span style={{ fontSize: 11, color: C.g500 }}>{isCol ? "▶" : "▼"}</span>
                  <strong style={{ fontSize: 13, color: C.navy }}>{g.nombre}</strong>
                  <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{g.rows[0].base.entidad}</span>
                  <span style={{ fontSize: 11, color: C.g500 }}>{g.rows.length} contratos</span>
                  <span style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
                    {perm.puedeEliminarHoja(g.nombre) && (
                      <button onClick={(e) => { e.stopPropagation(); setDelHoja({ nombre: g.nombre, n: contratos.filter((c) => c.hoja === g.nombre).length, texto: "" }); }}
                        style={{ ...actionBtn, padding: "3px 8px", color: C.red, borderColor: C.red }}>Eliminar constructora</button>
                    )}
                    {CON_ALARMA.filter((a) => gc[a]).map((a) => (
                      <span key={a} style={{ fontSize: 11, color: C.g700 }}>{gc[a]} {badge(a)}</span>
                    ))}
                  </span>
                </div>
                {!isCol && (
                  <div style={{ minWidth: 980 }}>
                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "6px 14px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.g200}` }}>
                      <span>Contrato</span><span>Proyecto</span><span>Objeto</span><span>Estado</span><span title="Valor vigente (último otrosí/liquidación que modifica VALOR)">Valor</span><span title="Fecha fin vigente (último otrosí/liquidación que modifica TIEMPO)">Fecha fin</span><span>Días</span><span>Otrosíes</span><span>Alarma</span>
                    </div>
                    {g.rows.map((c) => {
                      const isOpen = open === c.key;
                      const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                      const edita = perm.puedeEditarHoja(c.hoja), puedeDel = perm.puedeEliminarHoja(c.hoja);
                      const sub = puedeDel ? SUBCOLS + " 32px" : SUBCOLS;
                      return (
                        <div key={c.key} style={{ borderBottom: `1px solid ${C.g100}` }}>
                          <div onClick={() => { setOpen(isOpen ? null : c.key); setRowSel(null); setDraft(""); }}
                            style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 14px", fontSize: 12, color: C.g900, cursor: "pointer", alignItems: "center", background: isOpen ? C.blueL : "transparent" }}>
                            <span style={ellipsis}>{c.contrato || "—"}</span>
                            <span style={{ fontWeight: 600, ...ellipsis }} title={c.base.proyecto}>{c.base.proyecto || "—"}</span>
                            <span style={ellipsis} title={c.base.objeto}>{c.base.objeto || "—"}</span>
                            <span style={ellipsis}>{c.estadoEfectivo || "—"}</span>
                            <span>{c.valorVigente != null ? fmt(c.valorVigente) : "—"}</span>
                            <span>{c.fechaFinVigente || "—"}</span>
                            <span style={{ color: ALARMAS[c.alarma].color, fontWeight: 700 }}>{c.dias ?? "—"}</span>
                            <span>{c.otrosies}</span>
                            <span>{badge(c.alarma)}</span>
                          </div>
                          {isOpen && (
                            <div style={{ padding: "12px 14px 16px", background: C.off, fontSize: 12 }}>
                              <div style={{ border: `1px solid ${C.g200}`, borderRadius: 4, background: C.white, overflowX: "auto" }}>
                                <div style={{ minWidth: 700 }}>
                                  <div style={{ display: "grid", gridTemplateColumns: sub, gap: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", borderBottom: `1px solid ${C.g200}` }}>
                                    <span>Tipo</span><span>Objeto</span><span>Valor</span><span>Inicio</span><span>Fin</span><span>Estado</span><span>Modifica</span>{puedeDel && <span />}
                                  </div>
                                  {c.filas.map((f, i) => (
                                    <div key={i} onClick={() => setRowSel(rowSel === i ? null : i)}
                                      style={{ display: "grid", gridTemplateColumns: sub, gap: 8, padding: "6px 10px", cursor: "pointer", alignItems: "center", background: rowSel === i ? C.blueL : "transparent", borderBottom: `1px solid ${C.g100}` }}>
                                      <span>{f.tipo && f.tipo !== "---" ? f.tipo : "Contrato"}</span>
                                      <span style={ellipsis} title={f.objeto}>{f.objeto || "—"}</span>
                                      <span>{f.valor != null ? fmt(f.valor) : "—"}</span>
                                      <span>{f.fechaInicio || "—"}</span>
                                      <span>{f.fechaFin || "—"}</span>
                                      <span>{f.estado || "—"}</span>
                                      {esBase(f) ? <span>—</span> : (
                                        <select value={f.modifica} disabled={!edita} onClick={(e) => e.stopPropagation()} onChange={(e) => intenta(() => run(planEditarCampo(c, i, "modifica", f.modifica, e.target.value, ctx())))} style={{ ...inputStyle, padding: "2px 4px" }}>
                                          {MODIFICA.map((m) => <option key={m}>{m}</option>)}
                                        </select>
                                      )}
                                      {puedeDel && <button title="Eliminar esta fila" onClick={(e) => { e.stopPropagation(); borrarFila(c, i); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>🗑</button>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {edita && <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                                <button onClick={() => nuevaFila(c)} style={actionBtn}>＋ Agregar otrosí / liquidación</button>
                                <select value={tipoNueva} onChange={(e) => setTipoNueva(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                                  <option>OTROSÍ</option><option>LIQUIDACIÓN</option>
                                </select>
                                {rowSel !== null && <button onClick={() => setUnir({ src: c.key, idx: rowSel, q: "", dst: null })} style={actionBtn}>Mover esta fila…</button>}
                              </div>}
                              {rowSel !== null && renderForm(c, rowSel)}
                              <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase" }}>Fecha de compromiso:</span>
                                <input type="date" value={c.nota.fechaCompromiso || ""}
                                  onChange={(e) => intenta(() => run(planFecha(c, e.target.value, ctx())))}
                                  style={{ fontSize: 12, padding: "6px 8px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none" }} />
                                {edita && <button onClick={() => setUnir({ src: c.key, idx: null, q: "", dst: null })} style={{ ...actionBtn, marginLeft: "auto" }}>Unir a otro contrato…</button>}
                                {puedeDel && <button onClick={() => borrar(c)} style={{ ...actionBtn, color: C.red, borderColor: C.red, ...(edita ? {} : { marginLeft: "auto" }) }}>Eliminar contrato</button>}
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
                              {esAdmin && (
                                <div style={{ marginTop: 14 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.g500, textTransform: "uppercase", marginBottom: 6 }}>Historial de este contrato</div>
                                  {histRecent.filter((h) => h.contratoKey === c.key).slice(0, 30).map((h) => (
                                    <div key={h.id} style={{ fontSize: 11, color: C.g700, padding: "2px 0", borderBottom: `1px solid ${C.g100}` }}>
                                      {fmtAt(h.at)} · <strong>{h.usuario}</strong> · {h.accion}{h.detalle ? ` — ${h.detalle}` : ""}
                                    </div>
                                  ))}
                                  {!histRecent.some((h) => h.contratoKey === c.key) && <div style={{ fontSize: 11, color: C.g500 }}>Sin registros recientes.</div>}
                                </div>
                              )}
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
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 560 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>{modal.titulo}</h2>
            {modal.sinHoja && (() => {
              const h = modal.sinHoja, n = h.ambiguas.length + h.sinCoincidencia.length;
              return (
                <div style={{ background: "#fdecea", border: "2px solid #c0392b", borderRadius: 4, padding: "8px 10px", margin: "0 0 10px", fontSize: 12, color: C.g900 }}>
                  <strong>⚠ El archivo no trae la columna HOJA (hoja «{h.hoja}»).</strong> Se ubicaron {h.ubicadas} contratos en su constructora por número; {h.ambiguas.length} ambiguos y {h.sinCoincidencia.length} sin coincidencia quedarían en «{h.hoja}» como constructora nueva.
                  {n > 0 && (
                    <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11, marginTop: 6 }}>
                      {h.ambiguas.slice(0, 20).map((a, i) => <div key={"a" + i}>• {a.contrato} — ambiguo: {a.hojas.join(" / ")}</div>)}
                      {h.sinCoincidencia.slice(0, Math.max(0, 20 - h.ambiguas.length)).map((c, i) => <div key={"s" + i}>• {c} — sin coincidencia</div>)}
                      {n > 20 && <div>… y {n - 20} más</div>}
                    </div>
                  )}
                  {n > 0 && (
                    <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                      {[["solo", "Subir solo los ubicados"], ["todo", "Subir todo igual"]].map(([k, t]) => (
                        <label key={k} style={{ cursor: "pointer" }}><input type="radio" checked={modal.modo === k} onChange={() => setModal({ ...modal, modo: k })} /> {t}</label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {cargaSel && (
              <>
                <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>
                  {cargaSel.carga ? `${cargaSel.carga.cs.length} contratos en el archivo: ${cargaSel.carga.nuevos} nuevos · ${cargaSel.carga.actualizados} se actualizarán · ${cargaSel.noTocan} del portal no se tocan` : "No hay contratos para subir con esta opción."}
                </p>
                <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>{cargaSel.filas} filas leídas. Los contratos del archivo reemplazan los del portal; comentarios y fecha de compromiso se conservan.</p>
                {cargaSel.unidos > 0 && <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>{cargaSel.unidos} contrato(s) del archivo se unieron a otro por uniones hechas antes en el portal.</p>}
                {cargaSel.masivas.map(([h, n]) => (
                  <p key={h} style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", margin: "0 0 8px" }}>¿Seguro? Se crearían {n} contratos nuevos en una constructora nueva («{h}»); parece un archivo sin la columna HOJA.</p>
                ))}
              </>
            )}
            {modal.lineas?.map((l, i) => <p key={i} style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>{l}</p>)}
            {modal.avisos?.length > 0 && (
              <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: "6px 10px", margin: "8px 0", maxHeight: 160, overflowY: "auto", fontSize: 11, color: C.g700 }}>
                <strong>Avisos ({modal.avisos.length})</strong>
                {modal.avisos.map((a, i) => <div key={i}>• {a}</div>)}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setModal(null)}>{cargaSel ? "Cancelar" : "Cerrar"}</button>
              {cargaSel?.carga && <button style={{ ...actionBtn, background: C.accent, color: C.white, borderColor: C.accent }} onClick={confirmarCarga}>Actualizar</button>}
            </div>
          </div>
        </div>
      )}

      {nuevo && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 820 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Nuevo contrato</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              <div>
                <div style={labelStyle}>Hoja / constructora *</div>
                <input list="hojas-contratos" value={nuevo.hoja} onChange={(e) => cambiaNuevo(e.target.value, nuevo.vals)} style={inputStyle} />
                <datalist id="hojas-contratos">{hojasEditables.map((h) => <option key={h} value={h} />)}</datalist>
              </div>
              {CAMPOS.filter((f) => f.tipo !== "calc" && f.key !== "tipo").map((f) => (
                <div key={f.key} style={{ gridColumn: f.key === "objeto" ? "1 / -1" : undefined }}>
                  <div style={labelStyle}>{f.h.replace(" mm/aaaa", "")}{f.key === "contrato" ? " *" : ""}</div>
                  {f.key === "estado" ? <EstadoSelect value={nuevo.vals.estado} onChange={(x) => setNuevo({ ...nuevo, vals: { ...nuevo.vals, estado: x } })} /> : (
                    <input value={nuevo.vals[f.key] || ""} onChange={(e) => setNuevo({ ...nuevo, vals: { ...nuevo.vals, [f.key]: e.target.value } })}
                      type={f.tipo === "date" ? "date" : f.tipo === "text" ? "text" : "number"} step="any" style={inputStyle} />
                  )}
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

      {exp && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 760 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Exportar a Excel</h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
              <label style={{ fontSize: 12 }}><div style={labelStyle}>Formato</div>
                <select value={exp.formato} onChange={(e) => setExp({ ...exp, formato: e.target.value })} style={{ ...inputStyle, width: "auto" }}>
                  <option value="hoja">Una hoja por constructora</option><option value="unica">Una sola hoja</option>
                </select></label>
              <label style={{ fontSize: 12 }}><div style={labelStyle}>Contenido</div>
                <select value={exp.contenido} onChange={(e) => setExp({ ...exp, contenido: e.target.value })} style={{ ...inputStyle, width: "auto" }}>
                  <option value="completo">Contrato con otrosíes y liquidaciones</option><option value="general">Solo el contrato general</option>
                </select></label>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <input value={exp.q} onChange={(e) => setExp({ ...exp, q: e.target.value })} placeholder="Buscar contrato, objeto, proyecto..." style={{ ...inputStyle, width: 240 }} />
              <button style={actionBtn} onClick={() => setSelExp(contratos.map((c) => c.key), true)}>Todos</button>
              <button style={actionBtn} onClick={() => setExp({ ...exp, sel: {} })}>Ninguno</button>
              <button style={actionBtn} onClick={() => setExp({ ...exp, sel: Object.fromEntries(visibles.map((c) => [c.key, true])) })}>Solo los visibles con el filtro actual</button>
            </div>
            <div style={{ border: `1px solid ${C.g200}`, borderRadius: 4, maxHeight: "45vh", overflowY: "auto", fontSize: 12 }}>
              {expGrupos.length === 0 && <div style={{ padding: 12, color: C.g500 }}>Sin resultados.</div>}
              {expGrupos.map(([hoja, rows]) => (
                <div key={hoja}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", background: C.g100, fontWeight: 700, color: C.navy, position: "sticky", top: 0 }}>
                    <input type="checkbox" checked={rows.every((r) => exp.sel[r.key])} onChange={(e) => setSelExp(rows.map((r) => r.key), e.target.checked)} />
                    {hoja} <span style={{ fontWeight: 400, color: C.g500 }}>({rows.filter((r) => exp.sel[r.key]).length}/{rows.length})</span>
                  </label>
                  {rows.map((r) => (
                    <label key={r.key} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 10px 3px 28px", borderBottom: `1px solid ${C.g100}` }}>
                      <input type="checkbox" checked={!!exp.sel[r.key]} onChange={(e) => setSelExp([r.key], e.target.checked)} />
                      <span style={{ minWidth: 120, fontWeight: 600 }}>{r.contrato || "—"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.g700 }}>{r.base.proyecto || r.base.objeto || ""}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setExp(null)}>Cancelar</button>
              <button style={{ ...actionBtn, ...primario, opacity: nExp ? 1 : 0.5 }} disabled={!nExp} onClick={exportar}>Exportar ({nExp} contratos)</button>
            </div>
          </div>
        </div>
      )}

      {unir && (() => {
        const src = porKey.get(unir.src), q = unir.q.trim().toLowerCase();
        if (!src) return null;
        const fila = unir.idx != null && src.filas.length > 1 ? src.filas[unir.idx] : null;
        const lista = contratos.filter((c) => c.key !== unir.src && perm.puedeEditarHoja(c.hoja) && coincide(c, q))
          .sort((a, b) => (b.hoja === src.hoja) - (a.hoja === src.hoja) || a.hoja.localeCompare(b.hoja) || a.orden - b.orden).slice(0, 100);
        return (
          <div style={overlay}>
            <div style={{ ...dialog, maxWidth: 680 }}>
              <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 4px" }}>{fila ? "Mover esta fila a otro contrato" : "Unir a otro contrato"}</h2>
              <p style={{ fontSize: 12, color: C.g700, margin: "0 0 8px" }}>
                {fila ? `Fila "${fila.tipo && fila.tipo !== "---" ? fila.tipo : "Contrato"}" de ` : "Todas las filas de "}<strong>{etiqueta(src)}</strong>
                {fila ? " pasa al contrato elegido." : " pasan al contrato elegido y este desaparece (las próximas cargas del Excel lo seguirán uniendo)."}
              </p>
              <input autoFocus value={unir.q} onChange={(e) => setUnir({ ...unir, q: e.target.value })} placeholder="Buscar contrato, objeto, proyecto..." style={{ ...inputStyle, marginBottom: 8 }} />
              <div style={{ border: `1px solid ${C.g200}`, borderRadius: 4, maxHeight: "45vh", overflowY: "auto", fontSize: 12 }}>
                {lista.length === 0 && <div style={{ padding: 12, color: C.g500 }}>Sin resultados.</div>}
                {lista.map((c) => (
                  <label key={c.key} style={{ display: "grid", gridTemplateColumns: "20px 120px 1fr 1fr", gap: 8, padding: "5px 10px", cursor: "pointer", alignItems: "center", background: unir.dst === c.key ? C.blueL : "transparent", borderBottom: `1px solid ${C.g100}` }}>
                    <input type="radio" checked={unir.dst === c.key} onChange={() => setUnir({ ...unir, dst: c.key })} />
                    <span style={{ fontWeight: 600 }}>{c.contrato || "—"}{c.hoja !== src.hoja && <div style={{ fontWeight: 400, fontSize: 10, color: C.g500 }}>{c.hoja}</div>}</span>
                    <span title={c.base.objeto} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.base.objeto || "—"}</span>
                    <span title={c.base.proyecto} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.g700 }}>{c.base.proyecto || "—"}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button style={actionBtn} onClick={() => setUnir(null)}>Cancelar</button>
                <button style={{ ...actionBtn, ...primario, opacity: unir.dst ? 1 : 0.5 }} disabled={!unir.dst || busy} onClick={() => ejecutarUnir(unir.src, unir.dst, unir.idx)}>{fila ? "Mover fila" : "Unir"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {sugOpen && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 760 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Sugerencias de corrección ({sugs.length})</h2>
            {sugs.length === 0 && <p style={{ fontSize: 12, color: C.g500 }}>No quedan sugerencias.</p>}
            {sugs.map((s) => {
              const a = porKey.get(s.key), b = porKey.get(s.destino);
              return (
                <div key={s.key} style={{ border: `1px solid ${C.g200}`, borderRadius: 4, padding: "8px 10px", marginBottom: 8, fontSize: 12 }}>
                  <div><strong>{etiqueta(a)}</strong> <span style={{ color: C.g500 }}>{a.base.proyecto || a.base.objeto || ""} · {a.filas.length} fila(s)</span></div>
                  <div style={{ color: C.g700, margin: "2px 0 6px" }}>{s.razon} → <strong>{etiqueta(b)}</strong></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...actionBtn, ...primario }} disabled={busy} onClick={() => unirSugerido(s)}>Unir con {b.contrato || "(sin número)"}</button>
                    <button style={actionBtn} onClick={() => intenta(() => run(planIgnorarSug(porKey.get(s.key), ctx())))}>Ignorar</button>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setSugOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {delHoja && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 460 }}>
            <h2 style={{ fontSize: 15, color: C.red, margin: "0 0 10px" }}>Eliminar constructora</h2>
            <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>Se eliminarán <strong>{delHoja.n} contrato(s)</strong> de <strong>{delHoja.nombre}</strong>. No se puede deshacer. Escribe el nombre exacto de la constructora para confirmar:</p>
            <input autoFocus value={delHoja.texto} onChange={(e) => setDelHoja({ ...delHoja, texto: e.target.value })} placeholder={delHoja.nombre} style={inputStyle} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setDelHoja(null)}>Cancelar</button>
              <button style={{ ...actionBtn, background: C.red, color: C.white, borderColor: C.red, opacity: delHoja.texto.trim() === delHoja.nombre ? 1 : 0.5 }} disabled={busy || delHoja.texto.trim() !== delHoja.nombre} onClick={borrarHoja}>Eliminar {delHoja.n} contrato(s)</button>
            </div>
          </div>
        </div>
      )}

      {histOpen && esAdmin && <HistorialContratos db={dbRef.current} recent={histRecent} onClose={() => setHistOpen(false)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, fontSize: 12, fontWeight: 600, padding: "10px 20px", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.2)", zIndex: 1200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
