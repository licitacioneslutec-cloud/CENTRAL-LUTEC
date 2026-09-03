import * as XLSX from "xlsx";

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
  const ws = XLSX.utils.json_to_sheet(data);
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
