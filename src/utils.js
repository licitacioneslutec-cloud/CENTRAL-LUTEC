import * as XLSX from "xlsx";

// Formats a number as Colombian peso currency, e.g. fmt(335580) -> "$335.580"
export const fmt = (n) => (!n && n !== 0 ? "$0" : "$" + Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 }));

// Maps Excel column headers to the code's field keys. Numeric fields are
// coerced with Number() when read.
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
};

const NUMERIC_KEYS = new Set(["iva", "total"]);

// Maps one Excel row (object keyed by column header) to a factura record
// keyed by code field names.
function mapRow(row) {
  const out = {};
  for (const [col, key] of Object.entries(COLUMN_MAP)) {
    if (!(col in row)) continue;
    const raw = row[col];
    out[key] = NUMERIC_KEYS.has(key) ? Number(raw) || 0 : raw;
  }
  return out;
}

// Parses an uploaded Excel workbook (as an ArrayBuffer) into facturas,
// split by sheet name: sheets whose name contains "novedad" (case-insensitive)
// go to `novedades`, everything else goes to `noRadicadas`.
export function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const result = { novedades: [], noRadicadas: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const bucket = /novedad/i.test(sheetName) ? "novedades" : "noRadicadas";
    result[bucket].push(...rows.map(mapRow));
  }

  return result;
}
