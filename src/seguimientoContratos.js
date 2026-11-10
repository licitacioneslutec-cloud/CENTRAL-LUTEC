// Seguimiento de contratos por entrar (pendientes de firma). Pestaña "Por entrar" del módulo Contratos.
// RTDB contratosSeguimiento/{segKey} = { ...campos, orden, pasadoA?: contratoKey, actualizadoAt, actualizadoPor }.
// Las alarmas se cuentan desde la FECHA DE LLEGADA DEL CONTRATO mientras no haya fecha de firmado por todas las partes.
// Funciones puras (sin React ni Firebase): seguimientoContratos.check.js
import * as XLSX from "xlsx";
import { norm, nh, aFecha, serial } from "./contratosExcel.js";

// tipo: text | fecha (fecha o texto libre: "N/A", "RECHAZADO POR …") | calc. hito = paso del proceso, en orden.
export const CAMPOS_SEG = [
  { key: "notificacion", h: "NOTIFICACIÓN DE APROBACIÓN DE LICITACIONES TODOS LOS LUNES", tipo: "fecha", w: 20 },
  { key: "cliente", h: "CLIENTE", tipo: "text", w: 24 },
  { key: "proyecto", h: "PROYECTO", tipo: "text", w: 24 },
  { key: "seguimiento", h: "FECHA DE SEGUIMIENTO DEL CONTRATO AL CLIENTE TODOS LOS MARTES", tipo: "fecha", w: 20 },
  { key: "observaciones", h: "OBSERVACIONES DEL SEGUIMIENTO DEL CONTRATO", tipo: "text", w: 40 },
  { key: "alarma15", h: "ALARMA DE 15 DÍAS A LA FECHA DE HOY", tipo: "calc", w: 16 },
  { key: "contrato", h: "No. CONTRATO", tipo: "text", w: 18 },
  { key: "tipo", h: "TIPO", tipo: "text", w: 14 },
  { key: "area", h: "ÁREA A CARGO", tipo: "text", w: 14 },
  { key: "llegada", h: "FECHA DE LLEGADA DEL CONTRATO", tipo: "fecha", w: 16, hito: true },
  { key: "presupuesto", h: "FECHA DE APROBACIÓN DE PRESUPUESTO", tipo: "fecha", w: 16, hito: true },
  { key: "aprobAreas", h: "FECHA DE APROBACIÓN DE LAS ÁREAS (INGENIERIA-ILUMINACIÓN)", tipo: "fecha", w: 18, hito: true },
  { key: "envio", h: "FECHAS DE ENVIÓ DEL CONTRATO FIRMADO AL CLIENTE / ASEGURADORA", tipo: "fecha", w: 18, hito: true },
  { key: "polizas", h: "FECHA DE LLEGADA DE PÓLIZAS", tipo: "fecha", w: 16, hito: true },
  { key: "legalizacion", h: "FECHA DE LEGALIZACIÓN CLIENTE", tipo: "fecha", w: 16, hito: true },
  { key: "correo", h: "FECHA DE ENVIÓ CORREO DE NOTIFICACIÓN A TODAS LAS ÁREAS", tipo: "fecha", w: 18, hito: true },
  { key: "anticipo", h: "FECHA DE PAGO DE ANTICIPO", tipo: "fecha", w: 16, hito: true },
  { key: "contabPolizas", h: "CONTABILIZACIÓN PÓLIZAS", tipo: "fecha", w: 16, hito: true },
  { key: "monday", h: "FECHA DE CARGUE DE CONTRATO A MONDAY", tipo: "fecha", w: 16, hito: true },
  { key: "alarma30", h: "ALARMA DE CONTRATOS SIN FIRMA 30 DÍAS", tipo: "calc", w: 16 },
  { key: "firmado", h: "FECHA DE LLEGADA DEL CONTRATO FIRMADO POR TODAS LAS PARTES", tipo: "fecha", w: 18, hito: true },
  { key: "tiempo", h: "TIEMPO DE TODO EL PROCESO", tipo: "calc", w: 14 },
];
export const TIPOS_SEG = ["INICIAL", "OTROSÍ No. 1", "OTROSÍ No. 2", "OTROSÍ No. 3", "OTROSÍ No. 4"];
export const AREAS = ["INGENIERÍA", "ILUMINACIÓN", "DISEÑO"];
export const HITOS = CAMPOS_SEG.filter((f) => f.hito);
const POR_ENC = new Map(CAMPOS_SEG.map((f) => [nh(f.h), f]));

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
// Valor de una celda "fecha": "YYYY-MM-DD" si es fecha, si no el texto tal cual ("N/A"), null si está vacía.
export function aFechaTexto(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return aFecha(v) ?? String(v).trim();
}
// "YYYY-MM-DD" -> "dd/mm/aaaa"; texto igual.
export const verFecha = (v) => (esFecha(v) ? v.split("-").reverse().join("/") : v ?? "");

// Clave RTDB-segura: CONTRATO|TIPO (INICIAL si falta); sin número: ~CLIENTE|PROYECTO.
export function segKey(f) {
  const k = f.contrato ? `${norm(f.contrato)}|${norm(f.tipo || "INICIAL")}` : `~${norm(f.cliente)}|${norm(f.proyecto)}`;
  return k.replace(/[.#$[\]/\x00-\x1f]/g, "-");
}

// ─── leerSeguimiento(arrayBuffer) → { filas: [{key, orden, ...campos}], avisos } ───
export function leerSeguimiento(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, sheetRows: 3000 });
  const filas = [], avisos = [], vistas = new Map();
  wb.SheetNames.forEach((name, si) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const hi = rows.slice(0, 20).findIndex((r) => r.map(nh).includes("CLIENTE") && r.some((h) => /LLEGADA DEL CONTRATO/.test(nh(h))));
    if (hi < 0) { if (rows.some((r) => r.some((v) => v != null))) avisos.push(`Hoja "${name.trim()}" omitida: no tiene los encabezados del seguimiento.`); return; }
    const cols = [];
    rows[hi].forEach((h, i) => { const f = h !== null && POR_ENC.get(nh(h)); if (f && f.tipo !== "calc") cols.push([i, f]); });
    const faltan = CAMPOS_SEG.filter((f) => f.tipo !== "calc" && !cols.some(([, g]) => g === f)).map((f) => f.h);
    if (faltan.length) avisos.push(`Hoja "${name.trim()}": faltan columnas ${faltan.join(", ")}.`);
    for (let r = hi + 1; r < rows.length; r++) {
      const fila = {};
      for (const [i, f] of cols) {
        const raw = rows[r][i];
        const v = f.tipo === "fecha" ? aFechaTexto(raw) : raw == null || String(raw).trim() === "" ? null : String(raw).trim();
        if (v !== null) fila[f.key] = v;
      }
      if (!fila.cliente && !fila.contrato && !fila.proyecto) continue;
      let key = segKey(fila);
      const n = (vistas.get(key) || 0) + 1;
      vistas.set(key, n);
      if (n > 1) { avisos.push(`Fila ${r + 1}: "${fila.contrato || fila.proyecto}" repetida; se guarda como #${n}.`); key += "#" + n; }
      filas.push({ key, orden: si * 10000 + r, ...fila });
    }
  });
  return { filas, avisos };
}

// ─── Estado y alarmas ───
// hoy = serial de Excel de hoy. Días desde la llegada; alarma: PASADO | FIRMADO | SIN (sin llegada) | A30 (>30) | A15 (>15) | PROCESO.
export const hoySerial = () => serial(new Date().toLocaleDateString("sv"));
export function estadoSeg(s, hoy = hoySerial()) {
  const lleg = serial(s.llegada), firm = serial(s.firmado);
  const dias = lleg ? (firm || hoy) - lleg : null;
  const siguiente = HITOS.find((h) => s[h.key] == null || s[h.key] === "")?.h ?? null;
  let alarma;
  if (s.pasadoA) alarma = "PASADO";
  else if (firm) alarma = "FIRMADO";
  else if (!lleg) alarma = "SIN";
  else alarma = dias > 30 ? "A30" : dias > 15 ? "A15" : "PROCESO";
  return { dias, alarma, tiempo: lleg && firm ? firm - lleg : null, siguiente };
}

// ─── Cambios (un update en la raíz; mismo historial que Contratos) ───
const hist = (ctx, accion, s, extra = {}) => ({
  [`contratosHistorial/${ctx.nuevoId()}`]: Object.fromEntries(Object.entries({ at: ctx.at || new Date().toISOString(), usuario: ctx.usuario, accion, hoja: s.cliente, contratoKey: "seg:" + s.key, contrato: s.contrato, ...extra }).filter(([, v]) => v !== undefined)),
});
const S = "contratosSeguimiento/";

export function planEditarSeg(s, campo, antes, despues, ctx) {
  return { [`${S}${s.key}/${campo}`]: despues ?? null, ...hist(ctx, "por entrar: editar", s, { campo, antes: antes ?? null, despues: despues ?? null }) };
}
export function planCrearSeg(fila, orden, ctx) {
  const key = segKey(fila);
  return { [S + key]: { ...fila, orden, actualizadoAt: new Date().toISOString(), actualizadoPor: ctx.usuario }, ...hist(ctx, "por entrar: crear", { ...fila, key }) };
}
export function planEliminarSeg(s, ctx) {
  return { [S + s.key]: null, ...hist(ctx, "por entrar: eliminar", s) };
}
// Carga: reemplaza solo las filas del archivo; conserva pasadoA de las existentes.
export function planCargaSeg(filas, existentes, archivo, ctx) {
  const at = new Date().toISOString(), upd = {};
  for (const { key, ...f } of filas) upd[S + key] = { ...f, ...(existentes[key]?.pasadoA ? { pasadoA: existentes[key].pasadoA } : {}), orden: existentes[key]?.orden ?? f.orden, actualizadoAt: at, actualizadoPor: ctx.usuario, archivo };
  const nuevos = filas.filter((f) => !existentes[f.key]).length;
  return { ...upd, ...hist({ ...ctx, at }, "por entrar: subir excel", {}, { detalle: `${archivo}: ${nuevos} nuevos, ${filas.length - nuevos} actualizados` }) };
}

// ─── Export con el formato del Excel (alarmas y tiempo como fórmulas) ───
export function libroSeguimiento(segs) {
  const L = (k) => XLSX.utils.encode_col(CAMPOS_SEG.findIndex((f) => f.key === k));
  const hoy = hoySerial();
  const ws = {};
  CAMPOS_SEG.forEach((f, i) => { ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { t: "s", v: f.h }; });
  [...segs].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).forEach((s, j) => {
    const r = j + 1, n = r + 1, e = estadoSeg(s, hoy);
    const lle = `${L("llegada")}${n}`, fir = `${L("firmado")}${n}`;
    CAMPOS_SEG.forEach((f, i) => {
      const ref = XLSX.utils.encode_cell({ r, c: i }), v = s[f.key];
      if (f.key === "alarma15") ws[ref] = { t: "s", v: e.alarma === "A15" || e.alarma === "A30" ? "ALARMA" : "", f: `IF(AND(ISNUMBER(${lle}),NOT(ISNUMBER(${fir})),TODAY()-${lle}>15),"ALARMA","")` };
      else if (f.key === "alarma30") ws[ref] = { t: "s", v: e.alarma === "A30" ? "SIN FIRMA" : "", f: `IF(AND(ISNUMBER(${lle}),NOT(ISNUMBER(${fir})),TODAY()-${lle}>30),"SIN FIRMA","")` };
      else if (f.key === "tiempo") ws[ref] = { t: "n", v: e.tiempo ?? 0, f: `IF(AND(ISNUMBER(${lle}),ISNUMBER(${fir})),${fir}-${lle},"")`, z: "0" };
      else if (v == null || v === "") return;
      else if (f.tipo === "fecha" && esFecha(v)) ws[ref] = { t: "n", v: serial(v), z: "d/mm/yyyy" };
      else ws[ref] = { t: "s", v: String(v) };
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(segs.length, 0), c: CAMPOS_SEG.length - 1 } });
  ws["!cols"] = CAMPOS_SEG.map((f) => ({ wch: f.w }));
  ws["!autofilter"] = { ref: ws["!ref"] };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Seguimiento");
  return wb;
}
