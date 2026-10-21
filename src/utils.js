import * as XLSX from "xlsx";
import { CAMPOS_EXCEL, CALC_HEADERS, COL_WIDTHS } from "./contratosParse";

// Formats a number as Colombian peso currency, e.g. fmt(335580) -> "$335.580"
export const fmt = (n) => (!n && n !== 0 ? "$0" : "$" + Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 }));

// Parses a Colombian-formatted currency value ("$ 53.580,00") or a plain
// number into a JS number. Handles values Excel already gave us as numbers too.
export function parseNum(raw) {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return Number(String(raw).replace(/[$\s.]/g, "").replace(",", ".")) || 0;
}

// Parses a "DD-MM-YYYY" string into a Date, or null if unparseable.
export function parseDateDMY(str) {
  if (!str) return null;
  const [d, m, y] = String(str).split("-");
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

// Exports an array of records to a downloadable .xlsx file.
export function exportToExcel(data, filename) {
  const rows = data.map((r) => {
    const row = { ...r };
    if (row.estadoModifiedAt) {
      const d = new Date(row.estadoModifiedAt);
      row.estadoModifiedAt = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Facturas");
  XLSX.writeFile(wb, filename);
}

// Maps Excel column headers to the code's field keys. Numeric fields are
// coerced with parseNum() when read.
const COLUMN_MAP = {
  "Tipo de documento": "tipoDoc",
  "CUFE/CUDE": "cufe",
  "Folio": "folio",
  "Prefijo": "prefijo",
  "Divisa": "divisa",
  "Forma de Pago": "formaPago",
  "Medio de Pago": "medioPago",
  "Fecha Emisión": "fechaEmision",
  "Fecha Recepción": "fechaRecepcion",
  "NIT Emisor": "nitEmisor",
  "Nombre Emisor": "nombreEmisor",
  "NIT Receptor": "nitReceptor",
  "Nombre Receptor": "nombreReceptor",
  "IVA": "iva",
  "Total": "total",
  "Estado": "estadoDoc",
  "Grupo": "grupo",
  "ESTADO": "estado",
  "observacion CONTABILIDAD": "observacion",
  "Columna1": "observacion",
  "RTA COMPRAS": "rtaCompras",
  "N° ERP": "nERP",
  "Nº ERP": "nERP",
  "Valor contabilizado": "valorContabilizado",
};

const NUMERIC_KEYS = new Set(["iva", "total", "valorContabilizado"]);

// Maps one Excel row (object keyed by column header) to a factura record
// keyed by code field names.
function mapRow(row) {
  const out = {};
  for (const [col, raw] of Object.entries(row)) {
    const key = COLUMN_MAP[col] || COLUMN_MAP[col.trim()];
    if (!key || key in out) continue;
    out[key] = NUMERIC_KEYS.has(key) ? parseNum(raw) : typeof raw === "string" ? raw.trim() : raw;
  }
  return out;
}

// Parses an uploaded Excel workbook (as an ArrayBuffer) into a flat array of
// facturas. Sheets whose name matches "no radicadas" stamp estado: "NO RADICADA"
// on rows that don't already carry an estado.
export function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const result = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const isNoRadicadas = /no.?radic/i.test(sheetName);
    for (const row of rows) {
      const mapped = mapRow(row);
      if (isNoRadicadas && !mapped.estado) mapped.estado = "NO RADICADA";
      result.push(mapped);
    }
  }

  return result;
}

// Exports contratos (each with `v` = effective field values keyed by CAMPOS_EXCEL.key) to an .xlsx,
// one sheet per constructora (v.entidad). Layout follows the accounting template: headers row 1, cols A–X.
const MONEY = '_-"$"* #,##0_-;\-"$"* #,##0_-;_-"$"* "-"??_-;_-@_-';
const serial = (s) => { // "YYYY-MM-DD" -> Excel date serial
  const [y, m, d] = String(s).split("-").map(Number);
  return y ? Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569 : null;
};
const colL = (i) => XLSX.utils.encode_col(i);

export function exportContratosExcel(contratos) {
  const bySheet = {};
  contratos.forEach((c) => { (bySheet[c.v.entidad || "SIN CONSTRUCTORA"] ||= []).push(c); });
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const hoy = Math.floor(Date.now() / 86400000) + 25569;
  const headers = [...CAMPOS_EXCEL.slice(0, 15).map((f) => f.h), ...CALC_HEADERS, ...CAMPOS_EXCEL.slice(15).map((f) => f.h)];

  for (const [nombre, rows] of Object.entries(bySheet).sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    rows.sort((a, b) => String(a.v.proyecto).localeCompare(String(b.v.proyecto), "es") || String(a.v.contrato).localeCompare(String(b.v.contrato), "es", { numeric: true }));
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    rows.forEach((c, i) => {
      const r = i + 2;
      const put = (col, cell) => { ws[colL(col) + r] = cell; };
      // A–O then S–X; P,Q,R (cols 15–17) are formulas
      CAMPOS_EXCEL.forEach((f, k) => {
        const col = k < 15 ? k : k + 3, val = c.v[f.key];
        if (val === undefined || val === null || val === "") return;
        if (f.tipo === "date") { const s = serial(val); if (s) put(col, { t: "n", v: s, z: "d/mm/yyyy" }); }
        else if (f.tipo === "pct") put(col, { t: "n", v: Number(val) / 100, z: "0%" });
        else if (f.tipo === "number") put(col, { t: "n", v: Number(val), z: f.key === "otrosies" ? "0" : MONEY });
        else put(col, { t: "s", v: String(val) });
      });
      const ini = ws["N" + r]?.v, fin = ws["O" + r]?.v;
      if (ini && fin) {
        put(15, { t: "n", f: `O${r}-N${r}`, v: fin - ini, z: "0" });
        put(16, { t: "n", f: `P${r}/30`, v: (fin - ini) / 30, z: "0.0" });
        put(17, { t: "n", f: `N${r}+P${r}-TODAY()`, v: ini + (fin - ini) - hoy, z: "0" });
      }
    });
    ws["!ref"] = `A1:X${rows.length + 1}`;
    ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    let name = nombre.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31).trim() || "SIN CONSTRUCTORA";
    for (let n = 2; used.has(name.toLowerCase()); n++) name = name.slice(0, 28) + " " + n;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `Contratos_LUTEC_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
