// Contratos: lee/escribe el "Cuadro de Experiencia" (una hoja por constructora, 24 columnas).
// Funciones puras (sin React ni Firebase) para poder probarlas en node: contratosExcel.check.js
import * as XLSX from "xlsx";

// Única definición de columnas (carga, formulario y export). tipo: text|number|date|pct|calc.
// calc = T/U/V: no se guardan, se calculan (en el export salen como fórmulas).
export const CAMPOS = [
  { key: "encargado", h: "ENCARGADO", tipo: "text", w: 25 },
  { key: "entidad", h: "ENTIDAD CONTRATANTE O PROPIETARIO DE LA OBRA", tipo: "text", w: 43 },
  { key: "nit", h: "NIT", tipo: "text", w: 16 },
  { key: "proyecto", h: "NOMBRE DEL PROYECTO", tipo: "text", w: 35 },
  { key: "direccion", h: "DIRECCIÓN DEL PROYECTO", tipo: "text", w: 27 },
  { key: "localizacion", h: "LOCALIZACIÓN", tipo: "text", w: 18 },
  { key: "objeto", h: "OBJETO", tipo: "text", w: 70 },
  { key: "contrato", h: "CONTRATO", tipo: "text", w: 22 },
  { key: "tipo", h: "TIPO", tipo: "text", w: 16 },
  { key: "valor", h: "VALOR DEL CONTRATO EJECUTADO A LA TERMINACIÓN ($)", tipo: "number", w: 32 },
  { key: "anticipo", h: "VALOR DEL ANTICIPO", tipo: "number", w: 19 },
  { key: "rete", h: "RETE-GARANTIA", tipo: "number", w: 19 },
  { key: "fechaInicio", h: "FECHA DE INICIACIÓN mm/aaaa", tipo: "date", w: 26 },
  { key: "fechaFin", h: "FECHA DE TERMINACIÓN mm/aaaa", tipo: "date", w: 26 },
  { key: "dias", h: "TIEMPO DE EJECUCIÓN EN DÍAS", tipo: "calc", w: 15 },
  { key: "meses", h: "TIEMPO DE EJECUCIÓN EN MESES", tipo: "calc", w: 15 },
  { key: "diasEj", h: "DÍAS DE EJECUCIÓN", tipo: "calc", w: 15 },
  { key: "estado", h: "ESTADO DE LA OBRA", tipo: "text", w: 18 },
  { key: "pct", h: "PORCENTAJE DE EJECUCIÓN", tipo: "pct", w: 16 },
  { key: "observaciones", h: "OBSERVACIONES", tipo: "text", w: 28 },
  { key: "contactoNombre", h: "NOMBRE DE CONTACTO", tipo: "text", w: 28 },
  { key: "contactoNumero", h: "NÚMERO DE CONTACTO", tipo: "text", w: 20 },
  { key: "contactoCorreo", h: "CORREO DE CONTACTO", tipo: "text", w: 25 },
  { key: "firmas", h: "FIRMAS", tipo: "text", w: 20 },
];

const sinTilde = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const norm = (s) => sinTilde(s).toUpperCase().replace(/\s+/g, " ").trim();
// Encabezado normalizado: sin tildes, mayúsculas, sin "mm/aaaa", guiones como espacio.
const nh = (s) => norm(s).replace(/MM\/AAAA/g, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
const POR_ENCABEZADO = new Map(CAMPOS.map((f) => [nh(f.h), f]));

const pad = (n) => String(n).padStart(2, "0");

function aFecha(v) {
  let y, m, d, x;
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    x = new Date(v.getTime() + 43200000); // +12h: absorbe la deriva de segundos de SheetJS
    [y, m, d] = [x.getFullYear(), x.getMonth() + 1, x.getDate()];
  } else if (typeof v === "number") {
    x = new Date(Math.floor(v) * 86400000 + Date.UTC(1899, 11, 30)); // serial Excel (>= 61)
    [y, m, d] = [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
  } else {
    const s = String(v ?? "").trim();
    if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) [y, m, d] = [+x[1], +x[2], +x[3]];
    else if ((x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [y, m, d] = [+x[3], +x[2], +x[1]];
    else if ((x = s.match(/^(\d{1,2})\/(\d{4})$/))) [y, m, d] = [+x[2], +x[1], 1];
    else return null;
  }
  return y >= 1950 && y < 2200 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function aNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[$\s]/g, "");
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return s && !isNaN(n) ? n : null;
}

// Fracción 0–1 (acepta 0.5, 50 o "50%").
function aPct(v) {
  if (typeof v === "string" && v.trim().endsWith("%")) { const n = aNum(v.trim().slice(0, -1)); return n === null ? null : n / 100; }
  const n = aNum(v);
  return n === null ? null : n > 1 ? n / 100 : n;
}

function aValor(f, v) {
  if (v === null || v === undefined || v === "") return null;
  if (f.tipo === "date") return aFecha(v);
  if (f.tipo === "number") return aNum(v);
  if (f.tipo === "pct") return aPct(v);
  const s = v instanceof Date ? aFecha(v) : String(v).trim();
  return s === "" ? null : s;
}

// ─── leerCuadro(arrayBuffer) → { filas, hojas, avisos } ───
// filas: [{ hoja, orden, ...campos }] solo con campos no vacíos. Encabezados por nombre, nunca por posición.
export function leerCuadro(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, sheetRows: 2000 });
  const filas = [], hojas = [], avisos = [];
  wb.SheetNames.forEach((name, si) => {
    const hoja = name.trim();
    if (/^(PLANTILLA|SMMLV)$/i.test(hoja)) { avisos.push(`Hoja "${hoja}" omitida (no es una constructora).`); return; }
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const hi = rows.slice(0, 20).findIndex((r) => {
      const hs = r.map(nh);
      return hs.includes("CONTRATO") && hs.includes("OBJETO");
    });
    if (hi < 0) { avisos.push(`Hoja "${hoja}" omitida: no se encontró la fila de encabezados (CONTRATO y OBJETO).`); return; }
    const cols = []; // [indiceColumna, campo]
    rows[hi].forEach((h, i) => { const f = h !== null && POR_ENCABEZADO.get(nh(h)); if (f) cols.push([i, f]); });
    const faltan = CAMPOS.filter((f) => !cols.some(([, g]) => g === f)).map((f) => f.key === "dias" || f.tipo === "calc" ? null : f.h).filter(Boolean);
    if (faltan.length) avisos.push(`Hoja "${hoja}": faltan columnas ${faltan.join(", ")}.`);
    const full = ws["!fullref"];
    if (full && XLSX.utils.decode_range(full).e.r >= 2000) avisos.push(`Hoja "${hoja}": solo se leyeron las primeras 2000 filas.`);
    let n = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const fila = { hoja, orden: si * 10000 + r };
      for (const [i, f] of cols) {
        if (f.tipo === "calc") continue;
        const v = aValor(f, rows[r][i]);
        if (v !== null) fila[f.key] = v;
      }
      if (!fila.contrato && !fila.objeto) continue;
      filas.push(fila); n++;
    }
    hojas.push(hoja);
    if (!n) avisos.push(`Hoja "${hoja}": sin filas de datos.`);
  });
  return { filas, hojas, avisos };
}

// ─── Contratos ───
// Clave RTDB-segura: hoja|CONTRATO normalizado (sin . # $ [ ] /). Sin CONTRATO: hoja|objeto (40 primeros).
// ponytail: "CO.1" y "CO-1" colisionan en la misma clave; improbable en la práctica.
export function contratoKey(hoja, fila) {
  const id = fila.contrato ? norm(fila.contrato) : norm(fila.objeto || "").slice(0, 40);
  return (norm(hoja) + "|" + id).replace(/[.#$[\]/\x00-\x1f]/g, "-");
}

const esBase = (f) => !f.tipo || f.tipo.trim() === "---" || f.tipo.trim() === "";
export const esOtrosi = (f) => /OTROS/.test(norm(f.tipo));

// Estado FINALIZADO o LIQUIDADO: nunca genera alarma.
export const esFinalizado = (estado) => /FINALIZAD|LIQUIDAD/.test(norm(estado));

// Contrato con derivados. filas = [{tipo, ...campos}] (sin hoja/orden).
export function armarContrato(key, hoja, contrato, orden, filas) {
  const base = filas.find(esBase) || filas[0] || {};
  const fines = filas.map((f) => f.fechaFin).filter(Boolean).sort();
  const estados = filas.map((f) => f.estado).filter(Boolean);
  return {
    key, hoja, contrato: contrato || "", orden, filas, base,
    sinContrato: !contrato,
    fechaFinEfectiva: fines.length ? fines[fines.length - 1] : null,
    estadoEfectivo: norm(estados[estados.length - 1] || ""),
  };
}

// Agrupa filas por hoja+CONTRATO; claves repetidas = mismo contrato, filas en orden de aparición.
export function agruparContratos(filas) {
  const m = new Map();
  for (const { hoja, orden, ...campos } of filas) {
    const k = contratoKey(hoja, campos);
    if (!m.has(k)) m.set(k, { hoja, contrato: campos.contrato || "", orden, filas: [] });
    m.get(k).filas.push(campos);
  }
  return [...m].map(([k, c]) => armarContrato(k, c.hoja, c.contrato, c.orden, c.filas));
}

// Contrato leído de RTDB ({hoja, contrato, orden, filas}); Firebase puede devolver filas como objeto.
export function desdeDb(key, c) {
  const filas = Array.isArray(c.filas) ? c.filas : Object.values(c.filas || {});
  return armarContrato(key, c.hoja, c.contrato, c.orden ?? 0, filas.filter(Boolean));
}

// Días entre dos "YYYY-MM-DD" (null si falta alguno).
export function diasEntre(ini, fin) {
  if (!ini || !fin) return null;
  const d = (new Date(fin + "T00:00:00") - new Date(ini + "T00:00:00")) / 86400000;
  return isNaN(d) ? null : Math.round(d);
}

// ─── Export: un libro con una hoja por constructora, mismo formato que el Cuadro ───
const MONEY = '_-"$"* #,##0_-;\\-"$"* #,##0_-;_-"$"* "-"??_-;_-@_-';
const serial = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return y ? Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569 : null;
};

export function construirLibro(contratos) {
  const porHoja = new Map();
  [...contratos].sort((a, b) => a.orden - b.orden).forEach((c) => {
    if (!porHoja.has(c.hoja)) porHoja.set(c.hoja, []);
    porHoja.get(c.hoja).push(c);
  });
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const L = (k) => XLSX.utils.encode_col(CAMPOS.findIndex((f) => f.key === k));
  const hoy = Math.floor(Date.now() / 86400000) + 25569;

  for (const [hoja, cs] of porHoja) {
    const ws = {};
    CAMPOS.forEach((f, i) => { ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { t: "s", v: f.h }; });
    let r = 1;
    for (const c of cs) {
      for (const fila of c.filas) {
        CAMPOS.forEach((f, i) => {
          const v = fila[f.key];
          if (f.tipo === "calc" || v === undefined || v === null || v === "") return;
          const ref = XLSX.utils.encode_cell({ r, c: i });
          if (f.tipo === "date") { const s = serial(v); if (s) ws[ref] = { t: "n", v: s, z: "d/mm/yyyy" }; }
          else if (f.tipo === "pct") ws[ref] = { t: "n", v: Number(v), z: "0%" };
          else if (f.tipo === "number") ws[ref] = { t: "n", v: Number(v), z: MONEY };
          else ws[ref] = { t: "s", v: String(v) };
        });
        if (fila.fechaInicio && fila.fechaFin) {
          const n = r + 1, ini = serial(fila.fechaInicio), fin = serial(fila.fechaFin);
          const put = (k, cell) => { ws[L(k) + n] = cell; };
          put("dias", { t: "n", f: `${L("fechaFin")}${n}-${L("fechaInicio")}${n}`, v: fin - ini, z: "0" });
          put("meses", { t: "n", f: `${L("dias")}${n}/30`, v: (fin - ini) / 30, z: "0.0" });
          put("diasEj", { t: "n", f: `${L("fechaInicio")}${n}+${L("dias")}${n}-TODAY()`, v: fin - hoy, z: "0" });
        }
        r++;
      }
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, 0), c: CAMPOS.length - 1 } });
    ws["!cols"] = CAMPOS.map((f) => ({ wch: f.w }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    let name = hoja.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31).trim() || "SIN HOJA";
    for (let n = 2; usados.has(name.toLowerCase()); n++) name = name.slice(0, 28).trim() + " " + n;
    usados.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}
