// Pestaña "Por entrar" de Contratos: seguimiento de contratos pendientes de firma (lógica en seguimientoContratos.js).
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import SearchBar from "./SearchBar";
import { CAMPOS_SEG, TIPOS_SEG, AREAS, leerSeguimiento, estadoSeg, hoySerial, segKey, verFecha, aFechaTexto, planEditarSeg, planCrearSeg, planEliminarSeg, planCargaSeg, libroSeguimiento } from "../seguimientoContratos";

const ALARMAS = {
  A30: { label: "SIN FIRMA +30", color: C.red, bg: C.redL },
  A15: { label: "+15 DÍAS", color: "#c2410c", bg: "#fff7ed" },
  PROCESO: { label: "EN PROCESO", color: C.blue, bg: C.blueL },
  SIN: { label: "SIN LLEGADA", color: C.g500, bg: C.g100 },
  FIRMADO: { label: "FIRMADO", color: C.green, bg: C.greenL },
  PASADO: { label: "EN CONTRATOS", color: C.g700, bg: C.g100 },
};
const CON_ALARMA = ["A30", "A15"];
const FILTROS = [["ALARMA", "Con alarma"], ["PEND", "Pendientes de firma"], ["TODOS", "Todos"], ["A30", "Sin firma +30"], ["A15", "+15 días"], ["PROCESO", "En proceso"], ["SIN", "Sin llegada"], ["FIRMADO", "Firmados por pasar"], ["PASADO", "En Contratos"]];
const ORDEN = { A30: 0, A15: 1, PROCESO: 2, SIN: 3, FIRMADO: 4, PASADO: 5 };
const COLS = "130px minmax(120px,1fr) minmax(120px,1fr) 110px 100px 95px 60px minmax(160px,1.5fr) 110px";
const MAX_MB = 20;

const labelStyle = { fontSize: 10, fontWeight: 600, color: C.g500, textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", fontSize: 12, padding: "5px 7px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none" };
const actionBtn = { background: C.white, border: `1px solid ${C.g200}`, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const primario = { background: C.accent, color: C.white, borderColor: C.accent };
const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 };
const dialog = { background: C.white, borderRadius: 8, padding: 20, width: "100%", maxHeight: "90vh", overflowY: "auto" };
const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const EDITABLES = CAMPOS_SEG.filter((f) => f.tipo !== "calc");

// Texto de la casilla -> valor guardable. Fechas: dd/mm/aaaa, aaaa-mm-dd o texto ("N/A").
const parse = (f, txt) => (f.tipo === "fecha" ? aFechaTexto(txt) : txt.trim() || null);

// segs = valor de contratosSeguimiento; run(upd) aplica un update raíz; puedeEditar / puedeEliminar / puedeSubir según permisos de Contratos.
export default function SeguimientoContratos({ segs, run, ctx, showToast, puedeEditar, puedeEliminar, puedeSubir, onPasar }) {
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("ALARMA");
  const [open, setOpen] = useState(null);
  const [nuevo, setNuevo] = useState(null); // {key: texto}
  const [carga, setCarga] = useState(null); // { filas, avisos, archivo, nuevos }
  const [busy, setBusy] = useState(false);

  const hoy = hoySerial();
  const lista = useMemo(() => Object.entries(segs || {}).map(([key, s]) => ({ ...s, key, ...estadoSeg(s, hoy) })), [segs, hoy]);
  const counts = useMemo(() => {
    const n = { TODOS: lista.length, ALARMA: 0, PEND: 0, A30: 0, A15: 0, PROCESO: 0, SIN: 0, FIRMADO: 0, PASADO: 0 };
    lista.forEach((s) => { n[s.alarma]++; if (CON_ALARMA.includes(s.alarma)) n.ALARMA++; if (!["FIRMADO", "PASADO"].includes(s.alarma)) n.PEND++; });
    return n;
  }, [lista]);
  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lista
      .filter((s) => filtro === "TODOS" || (filtro === "ALARMA" ? CON_ALARMA.includes(s.alarma) : filtro === "PEND" ? !["FIRMADO", "PASADO"].includes(s.alarma) : s.alarma === filtro))
      .filter((s) => !q || [s.cliente, s.proyecto, s.contrato, s.tipo, s.area, s.observaciones].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => ORDEN[a.alarma] - ORDEN[b.alarma] || (b.dias ?? -1) - (a.dias ?? -1));
  }, [lista, filtro, search]);

  const intenta = (fn, msg) => Promise.resolve().then(fn).then(() => msg && showToast(msg)).catch((e) => showToast("No se pudo guardar: " + (e.message || e)));

  const guardar = (s, f, txt) => {
    const val = parse(f, txt), cur = s[f.key] ?? null;
    if (val === cur) return;
    intenta(() => run(planEditarSeg(s, f.key, cur, val, ctx())));
  };

  const crear = () => {
    const fila = {};
    for (const f of EDITABLES) { const v = parse(f, nuevo[f.key] || ""); if (v !== null) fila[f.key] = v; }
    if (!fila.cliente || (!fila.contrato && !fila.proyecto)) return showToast("Falta el cliente y el No. de contrato (o el proyecto)");
    if (segs?.[segKey(fila)]) return showToast("Ya existe un seguimiento con ese contrato y tipo");
    const orden = Math.max(0, ...lista.map((s) => s.orden ?? 0)) + 1;
    intenta(() => run(planCrearSeg(fila, orden, ctx())), "Seguimiento creado").then(() => { setNuevo(null); setFiltro("TODOS"); setOpen(segKey(fila)); });
  };

  const borrar = (s) => {
    if (!window.confirm(`¿Eliminar el seguimiento de ${s.contrato || s.proyecto || "(sin número)"} (${s.cliente})? No se puede deshacer.`)) return;
    intenta(() => run(planEliminarSeg(s, ctx())), "Seguimiento eliminado");
    setOpen(null);
  };

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_MB * 1048576) return showToast(`El archivo pesa más de ${MAX_MB} MB; borre las filas vacías con formato y vuelva a intentar.`);
    try {
      const { filas, avisos } = leerSeguimiento(await file.arrayBuffer());
      setCarga({ filas, avisos, archivo: file.name, nuevos: filas.filter((f) => !segs?.[f.key]).length });
    } catch (err) { showToast("No se pudo leer el archivo: " + (err.message || err)); }
  };
  const confirmarCarga = async () => {
    setBusy(true);
    await intenta(() => run(planCargaSeg(carga.filas, segs || {}, carga.archivo, ctx())), `Carga lista: ${carga.nuevos} nuevos, ${carga.filas.length - carga.nuevos} actualizados`);
    setCarga(null); setBusy(false);
  };

  const exportar = () => XLSX.writeFile(libroSeguimiento(visibles), `Seguimiento_Contratos_${new Date().toLocaleDateString("sv")}.xlsx`);

  const badge = (a) => <span style={{ background: ALARMAS[a].bg, color: ALARMAS[a].color, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>{ALARMAS[a].label}</span>;
  const filterBtn = (k) => ({ fontSize: 11, fontWeight: filtro === k ? 700 : 500, padding: "5px 12px", borderRadius: 4, cursor: "pointer", border: "none", background: filtro === k ? C.navy : C.white, color: filtro === k ? C.white : C.g700, boxShadow: filtro === k ? "none" : `inset 0 0 0 1px ${C.g200}` });

  // Casilla de un campo (detalle o formulario nuevo). value = texto inicial; onDone(texto).
  const casilla = (f, value, onDone, ro, onChange) => {
    const lista = f.key === "tipo" ? TIPOS_SEG : f.key === "area" ? AREAS : f.tipo === "fecha" ? ["N/A"] : null;
    const props = onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue: value, onBlur: (e) => onDone(e.target.value), onKeyDown: (e) => e.key === "Enter" && e.target.blur() };
    return (
      <>
        <input key={onChange ? f.key : f.key + value} {...props} disabled={ro} list={lista ? "seg-" + f.key : undefined} placeholder={f.tipo === "fecha" ? "dd/mm/aaaa o N/A" : ""} style={inputStyle} />
        {lista && <datalist id={"seg-" + f.key}>{lista.map((o) => <option key={o} value={o} />)}</datalist>}
      </>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, color: C.g500 }}>Contratos pendientes de firma. Las alarmas cuentan días desde la <strong>fecha de llegada del contrato</strong> hasta que llega firmado por todas las partes.</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <SearchBar search={search} setSearch={setSearch} placeholder="Buscar cliente, proyecto, contrato..." />
          {puedeSubir && <>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={onArchivo} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...actionBtn, ...primario }}>⬆ Subir Excel</button>
          </>}
          {puedeEditar && <button onClick={() => setNuevo({ tipo: "INICIAL" })} style={actionBtn}>＋ Nuevo</button>}
          <button onClick={exportar} disabled={!visibles.length} style={actionBtn}>⬇ Exportar Excel ({visibles.length})</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: C.g500, textTransform: "uppercase", marginRight: 4 }}>Filtrar:</span>
        {FILTROS.map(([k, l]) => <button key={k} style={filterBtn(k)} onClick={() => setFiltro(k)}>{l} ({counts[k]})</button>)}
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 6, overflowX: "auto" }}>
        <div style={{ minWidth: 1050 }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 14px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.g200}`, background: C.g100 }}>
            <span>Contrato</span><span>Cliente</span><span>Proyecto</span><span>Tipo</span><span>Área</span><span>Llegada</span><span title="Días desde la llegada del contrato (hasta la firma si ya llegó firmado)">Días</span><span>Siguiente paso</span><span>Alarma</span>
          </div>
          {visibles.length === 0 && <div style={{ padding: 30, textAlign: "center", color: C.g500, fontSize: 12 }}>{lista.length ? "No hay contratos para este filtro." : "Aún no hay seguimientos: use \"Subir Excel\" con el archivo SEGUIMIENTO DE CONTRATOS o \"＋ Nuevo\"."}</div>}
          {visibles.map((s) => {
            const isOpen = open === s.key;
            return (
              <div key={s.key} style={{ borderBottom: `1px solid ${C.g100}` }}>
                <div onClick={() => setOpen(isOpen ? null : s.key)} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 14px", fontSize: 12, color: C.g900, cursor: "pointer", alignItems: "center", background: isOpen ? C.blueL : "transparent", fontWeight: isOpen ? 700 : 400, borderLeft: `3px solid ${isOpen ? C.accent : "transparent"}` }}>
                  <span style={ellipsis}>{s.contrato || "—"}</span>
                  <span style={{ fontWeight: 600, ...ellipsis }} title={s.cliente}>{s.cliente || "—"}</span>
                  <span style={ellipsis} title={s.proyecto}>{s.proyecto || "—"}</span>
                  <span style={ellipsis}>{s.tipo || "—"}</span>
                  <span style={ellipsis}>{s.area || "—"}</span>
                  <span>{verFecha(s.llegada) || "—"}</span>
                  <span style={{ color: ALARMAS[s.alarma].color, fontWeight: 700 }}>{s.dias ?? "—"}</span>
                  <span style={{ ...ellipsis, color: C.g700 }} title={s.siguiente || ""}>{s.siguiente ? s.siguiente.replace(/^FECHAS? DE /, "") : "—"}</span>
                  <span>{badge(s.alarma)}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "12px 14px 16px", background: "#F3F7FC", borderLeft: `3px solid ${C.accent}`, fontSize: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                      {s.pasadoA ? <span style={{ color: C.g700 }}>✔ Ya está en Contratos ({s.pasadoA.replace("|", " · ")}).</span>
                        : s.alarma === "FIRMADO" && puedeEditar ? <button onClick={() => onPasar(s)} style={{ ...actionBtn, ...primario }}>Pasar a Contratos →</button>
                        : <span style={{ color: C.g500 }}>Cuando tenga la fecha de llegada firmado por todas las partes, podrá pasarlo a Contratos.</span>}
                      {s.tiempo != null && <span style={{ color: C.g700 }}>Tiempo de todo el proceso: <strong>{s.tiempo} días</strong></span>}
                      {puedeEliminar && <button onClick={() => borrar(s)} style={{ ...actionBtn, color: C.red, borderColor: C.red, marginLeft: "auto" }}>Eliminar</button>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, padding: 10, background: C.white, border: `1px solid ${C.g200}`, borderRadius: 4 }}>
                      {EDITABLES.map((f) => (
                        <div key={f.key} style={{ gridColumn: f.key === "observaciones" ? "1 / -1" : undefined }}>
                          <div style={{ ...labelStyle, color: f.hito ? C.navy : C.g500 }} title={f.h}>{f.h}</div>
                          {casilla(f, f.tipo === "fecha" ? verFecha(s[f.key]) : s[f.key] ?? "", (t) => guardar(s, f, t), !puedeEditar)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {nuevo && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 860 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Nuevo contrato por entrar</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {EDITABLES.map((f) => (
                <div key={f.key} style={{ gridColumn: f.key === "observaciones" ? "1 / -1" : undefined }}>
                  <div style={labelStyle}>{f.h}{f.key === "cliente" || f.key === "contrato" ? " *" : ""}</div>
                  {casilla(f, nuevo[f.key] || "", null, false, (t) => setNuevo({ ...nuevo, [f.key]: t }))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setNuevo(null)}>Cancelar</button>
              <button style={{ ...actionBtn, ...primario }} onClick={crear}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {carga && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 560 }}>
            <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Resumen de la carga</h2>
            <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>{carga.filas.length} contratos en el archivo: {carga.nuevos} nuevos · {carga.filas.length - carga.nuevos} se actualizarán · {Math.max(0, lista.length - (carga.filas.length - carga.nuevos))} del portal no se tocan.</p>
            <p style={{ fontSize: 12, color: C.g900, margin: "0 0 8px" }}>Las filas del archivo reemplazan las del portal (se conserva la marca "En Contratos").</p>
            {carga.avisos.length > 0 && (
              <div style={{ background: C.orangeL, border: `1px solid ${C.orange}`, borderRadius: 4, padding: "6px 10px", margin: "8px 0", maxHeight: 160, overflowY: "auto", fontSize: 11, color: C.g700 }}>
                <strong>Avisos ({carga.avisos.length})</strong>
                {carga.avisos.map((a, i) => <div key={i}>• {a}</div>)}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={actionBtn} onClick={() => setCarga(null)}>Cancelar</button>
              {carga.filas.length > 0 && <button style={{ ...actionBtn, ...primario }} disabled={busy} onClick={confirmarCarga}>Actualizar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
