// Pure helpers for the Contratos module: parse Monday item/group names + the Excel column definition.

// ─── extraerContrato(nombre) → { contrato, objeto } ───
const TIPO = /\b(CO|CON|OT|OM|OS|OC|CTO|CTC)\b[\s.,]*(?:N[oO]\b[\s.,]*)?/g;
// Code right after the tipo: optional "C-T91-15 " style prefix, optional letters-dash, digits, optional -SM/-MO.
const CODE = /^(?:[A-Z]{1,3}-[A-Z0-9-]*?\s)?(?:[A-Z]{1,3}-?)?\d[\d-]*(?:\s?-?\s?(?:SM|MO)\b)?/;

const limpiar = (s) => s.replace(/\s+[-/]\s*(?=[-/])/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s/,\-.]+|[\s/,\-.]+$/g, "");

export function extraerContrato(nombre) {
  const n = String(nombre || "").trim();
  let contrato = "", ini = -1, fin = -1;

  for (const m of n.matchAll(TIPO)) {
    let tipo = m[1] === "CON" ? "CO" : m[1];
    let rest = n.slice(m.index + m[0].length);
    let cm;
    if (/^-\s*\d/.test(rest)) { // "CO -101356" → CO-101356; "OM - 157" → OM No. 157
      cm = rest.match(/^-\s*(\d+)/);
      contrato = tipo === "CO" ? `CO No. CO-${cm[1]}` : `${tipo} No. ${cm[1]}`;
    } else if ((cm = rest.match(CODE))) {
      contrato = `${tipo} No. ${cm[0].trim()}`;
    } else continue;
    ini = m.index; fin = m.index + m[0].length + cm[0].length;
    break;
  }
  if (!contrato) {
    const m = n.match(/\bN[oO]\.?\s*(\d+-?(?:MO|SM))\b/) || n.match(/(?<!\d-)(?<!\d)(\d{4,}(?:-(?:SM|MO))?)\b/);
    if (m) {
      contrato = m[1];
      ini = m.index; fin = m.index + m[0].length;
    }
  }
  const objeto = ini < 0 ? n : limpiar(n.slice(0, ini) + " " + n.slice(fin));
  return { contrato, objeto: objeto || n };
}

// ─── parseGrupo(titulo) → { constructora, proyecto, localizacion, encargado } ───
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// canonical name → aliases (normalized)
const CONSTRUCTORAS = {
  CUSEZAR: ["CUSEZAR"], AMARILO: ["AMARILO"], URBANSA: ["URBANSA"], KORNER: ["KORNER"], PRODESA: ["PRODESA"],
  SOLERIUM: ["SOLERIUM"], OIKOS: ["OIKOS"], INGEURBE: ["INGEURBE"], ARPRO: ["ARPRO"],
  "HITOS URBANOS": ["HITOS URBANOS", "HITOS"], "PROMOTORA CALEDONIA": ["PROMOTORA CALEDONIA"], V2K: ["V2K"], BREK: ["BREK"],
  "CENTRO EMPRESARIAL DEL SALITRE S.A.S": ["CENTRO EMPRESARIAL DEL SALITRE"], "F MAZUERA": ["F MAZUERA", "FERNANDO MAZUERA"],
  "DESARROLLOS URBANOS": ["DESARROLLOS URBANOS"], ELEMENTAL: ["ELEMENTAL"], "CONSTRU VIVIR BIEN": ["CONSTRU VIVIR BIEN"],
  "IC CONSTRUCTORA": ["IC CONSTRUCTORA"], OTACC: ["OTACC", "OTTAC"], "TREZE CONSTRUCCIONES": ["TREZE CONSTRUCCIONES"],
  MENSULA: ["MENSULA"], TRIADA: ["TRIADA"], "MORPH GRANADA": ["MORPH GRANADA"],
};
const CIUDADES = ["BOGOTA", "CHIA", "MOSQUERA", "RICAURTE", "SANTAMARTA", "SANTA MARTA", "SAN ANDRES", "BARRANQUILLA", "CALI"];
const reAlias = (a) => new RegExp(`(^|[^A-Z0-9])${esc(a)}($|[^A-Z0-9])`);
const CONS_RES = Object.entries(CONSTRUCTORAS).map(([k, al]) => [k, al.map(reAlias)]);
const constructoraDe = (seg) => CONS_RES.find(([, res]) => res.some((r) => r.test(norm(seg))))?.[0];
const esCiudad = (seg) => CIUDADES.includes(norm(seg));
// ponytail: project-name hint for groups with no constructora in the title; extend list if more cases appear
const CUSEZAR_HINT = /GRATITUD|ALEGRIA|UNION|PLAZOLETA/;

export function parseGrupo(titulo) {
  const segs = String(titulo || "").split(/\s+-\s*|\s*-\s+|\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  const iC = segs.findIndex((s) => constructoraDe(s));
  const iCity = segs.findIndex(esCiudad);
  let constructora = iC >= 0 ? constructoraDe(segs[iC]) : "";
  if (!constructora && segs.length === 1 && CUSEZAR_HINT.test(norm(segs[0]))) constructora = "CUSEZAR";
  const iFb = iC < 0 ? segs.findIndex((s, i) => i > 0 && !esCiudad(s)) : -1; // fallback: 2nd segment
  if (!constructora && iFb > 0) constructora = segs[iFb];
  if (!constructora) constructora = "SIN CONSTRUCTORA";

  const iConsSeg = iC >= 0 ? iC : iFb;
  const iProy = segs.findIndex((s, i) => i !== iConsSeg && !esCiudad(s));
  const proyecto = iProy >= 0 ? segs[iProy] : (segs[0] || "");
  const desde = Math.max(iCity, iConsSeg, iProy) + 1;
  const encargado = segs.slice(iCity >= 0 ? iCity + 1 : desde)
    .filter((s) => !/^\d+$/.test(s) && !constructoraDe(s) && !esCiudad(s) && segs.indexOf(s) !== iProy)
    .join(" - ");
  return { constructora, proyecto, localizacion: iCity >= 0 ? segs[iCity] : "", encargado };
}

// ─── Excel columns (single source for form + export). A–O, then P–R computed, then S–X ───
// tipo: text|number|date|pct. monday: true when the default comes straight from Monday data.
const c0 = (c) => c.auto || {};
export const CAMPOS_EXCEL = [
  { key: "encargado", h: "ENCARGADO", tipo: "text", fuente: (c) => c0(c).encargado },
  { key: "entidad", h: "ENTIDAD CONTRATANTE O PROPIETARIO DE LA OBRA", tipo: "text", fuente: (c) => c0(c).constructora },
  { key: "proyecto", h: "NOMBRE DEL PROYECTO", tipo: "text", fuente: (c) => c0(c).proyecto },
  { key: "nit", h: "NIT", tipo: "text", fuente: () => "" },
  { key: "direccion", h: "DIRECCIÓN DEL PROYECTO", tipo: "text", fuente: () => "" },
  { key: "localizacion", h: "LOCALIZACIÓN", tipo: "text", fuente: (c) => c0(c).localizacion },
  { key: "objeto", h: "OBJETO", tipo: "text", fuente: (c) => c0(c).objeto },
  { key: "firmas", h: "FIRMAS", tipo: "text", fuente: () => "" },
  { key: "contrato", h: "CONTRATO", tipo: "text", fuente: (c) => c.nContrato || c0(c).contrato, monday: true },
  { key: "otrosies", h: "OTROSÍES", tipo: "number", fuente: (c) => c.otrosies ?? 0, monday: true },
  { key: "valor", h: "VALOR DEL CONTRATO EJECUTADO A LA TERMINACIÓN ($)", tipo: "number", fuente: (c) => c.valor, monday: true },
  { key: "anticipo", h: "VALOR DEL ANTICIPO", tipo: "number", fuente: (c) => c.anticipo, monday: true },
  { key: "retegarantia", h: "RETE GARANTÍA", tipo: "number", fuente: (c) => c.retegarantiaCobro, monday: true },
  { key: "fechaInicio", h: "FECHA DE INICIACIÓN", tipo: "date", fuente: (c) => c.fechaInicio, monday: true },
  { key: "fechaFin", h: "FECHA DE TERMINACIÓN", tipo: "date", fuente: (c) => c.fechaFin, monday: true },
  // P, Q, R computed here (inserted by the exporter)
  { key: "estado", h: "ESTADO DE LA OBRA", tipo: "text", fuente: (c) => c.estado, monday: true },
  { key: "pct", h: "PORCENTAJE DE EJECUCIÓN", tipo: "pct", fuente: (c) => c.avance, monday: true },
  { key: "observaciones", h: "OBSERVACIONES", tipo: "text", fuente: () => "" },
  { key: "contactoNombre", h: "NOMBRE DE CONTACTO", tipo: "text", fuente: () => "" },
  { key: "contactoNumero", h: "NÚMERO DE CONTACTO", tipo: "text", fuente: () => "" },
  { key: "contactoCorreo", h: "CORREO DE CONTACTO", tipo: "text", fuente: () => "" },
];
export const CALC_HEADERS = [
  "TIEMPO DE EJECUCIÓN EN DÍAS", "TIEMPO DE EJECUCIÓN EN MESES", "DÍAS DE EJECUCIÓN",
];
// Column widths in the reference file A–X order.
export const COL_WIDTHS = [7, 43, 25, 25, 27, 18, 86, 39, 16, 12, 32, 19, 19, 26, 23, 20, 21, 15, 16, 28, 28, 25, 20, 31];

// Effective value of one field for a contract: local override ?? Monday/auto default.
export const valorEfectivo = (c, f) => c.nota?.campos?.[f.key] ?? f.fuente(c);

// Days between two "YYYY-MM-DD" strings (null if either is missing/invalid).
export function diasEntre(ini, fin) {
  if (!ini || !fin) return null;
  const d = (new Date(fin + "T00:00:00") - new Date(ini + "T00:00:00")) / 86400000;
  return isNaN(d) ? null : Math.round(d);
}
