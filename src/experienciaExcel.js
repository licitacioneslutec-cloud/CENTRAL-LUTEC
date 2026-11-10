// Experiencia Contratistas: mismo motor que Contratos (contratosExcel.js) con el formato del Excel "Experiencia Contratistas"
// (hojas GENERAL y ORDEN DE TRABAJO; la columna TIPO no tiene encabezado, va justo después de CONTRATO).
// RTDB: experienciaExcel/contratos/{hoja|CONTRATO}, experienciaExcel/_meta, experienciaExcel/_smmlv {año: salario},
// experienciaNotas, experienciaAlias, experienciaHistorial (mismas formas que en Contratos).
import { CALC, serial, CONTRATOS } from "./contratosExcel.js";

const anio = (s) => Number(String(s ?? "").slice(0, 4));

export const CAMPOS_EXP = [
  { key: "contratista", h: "CONTRATISTA", tipo: "text", w: 34 },
  { key: "nit", h: "NIT", tipo: "text", w: 16 },
  { key: "entidad", h: "ENTIDAD CONTRATANTE O PROPIETARIO DE LA OBRA", tipo: "text", w: 30 },
  { key: "proyecto", h: "NOMBRE DEL PROYECTO", tipo: "text", w: 30 },
  { key: "direccion", h: "DIRECCIÓN DEL PROYECTO", tipo: "text", w: 22 },
  { key: "localizacion", h: "LOCALIZACIÓN", tipo: "text", w: 16 },
  { key: "objeto", h: "OBJETO", tipo: "text", w: 60 },
  { key: "contrato", h: "CONTRATO", tipo: "text", w: 16 },
  { key: "tipo", h: "TIPO", tipo: "text", w: 16 },
  { key: "valor", h: "VALOR DEL CONTRATO EJECUTADO A LA TERMINACIÓN ($)", tipo: "number", w: 26 },
  { key: "smmlv", h: "VALOR DEL CONTRATO EJECUTADO EN SMMLV", tipo: "calc", w: 16, req: ["fechaFin"], z: "0.00",
    v: (r, x) => (r.valor != null && x.smmlv[anio(r.fechaFin)] ? r.valor / x.smmlv[anio(r.fechaFin)] : null),
    f: (L, n) => `IFERROR(${L("valor")}${n}/VLOOKUP(YEAR(${L("fechaFin")}${n}),SMMLV!$A:$B,2,FALSE),"")` },
  { key: "fic", h: "FIC", tipo: "number", w: 14, opcional: true },
  { key: "rete", h: "RETE - GARANTÍA", tipo: "number", w: 14, opcional: true, z: "0%" },
  { key: "fechaInicio", h: "FECHA DE INICIACIÓN mm/aaaa", tipo: "date", w: 18 },
  { key: "fechaFin", h: "FECHA DE TERMINACIÓN mm/aaaa", tipo: "date", w: 18 },
  { key: "dias", h: "TIEMPO DE EJECUCIÓN EN DÍAS", tipo: "calc", w: 14, ...CALC.dias },
  { key: "meses", h: "TIEMPO DE EJECUCIÓN EN MESES", tipo: "calc", w: 14, ...CALC.meses(28) }, // el Excel original divide entre 28
  { key: "diasEj", h: "DÍAS DE EJECUCIÓN", tipo: "calc", w: 14, ...CALC.diasEj },
  { key: "estado", h: "ESTADO DE LA OBRA", tipo: "text", w: 18 },
  { key: "observaciones", h: "OBSERVACIONES", tipo: "text", w: 28, opcional: true }, // no viene en el Excel original: sale en el export solo si se usa
  { key: "porcentaje", h: "PORCENTAJE DE EJECUCIÓN", tipo: "calc", w: 14, req: ["fechaInicio", "fechaFin"], z: "0%",
    v: (r, x) => { const d = serial(r.fechaFin) - serial(r.fechaInicio); return d ? (serial(r.fechaFin) - x.hoy) / d : null; },
    f: (L, n) => `IFERROR(${L("diasEj")}${n}/${L("dias")}${n},"")` },
  { key: "contactoNombre", h: "NOMBRE DE CONTACTO", tipo: "text", w: 28 },
  { key: "contactoNumero", h: "NÚMERO DE CONTACTO", tipo: "text", w: 18 },
  { key: "fisico", h: "FÍSICO", tipo: "text", w: 10 },
];

export const EXPERIENCIA = {
  raiz: "experiencia", campos: CAMPOS_EXP, archivo: "Experiencia_Contratistas",
  grupo: (c) => c.base.contratista || "(sin contratista)", porHoja: false, precarga: [],
  etiqueta: "Experiencia Contratistas", titulo: "Contratos de Contratistas", hojaLabel: "Hoja (GENERAL / ORDEN DE TRABAJO)", grupoLabel: "hoja",
  vacio: "Aún no hay contratos: use \"Subir Excel\" con el archivo Experiencia Contratistas.",
  subtitulo: (c) => c.base.nit,
  cols: [["Hoja", (c) => c.hoja], CONTRATOS.cols[1]], // Observación (última no vacía); el OBJETO se ve al desplegar
};
