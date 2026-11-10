// Prueba: node src/experienciaExcel.check.js ["ruta/Experiencia Contratistas.xlsx"]
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { leerCuadro, agruparContratos, construirLibro, valorCalc } from "./contratosExcel.js";
import { EXPERIENCIA, CAMPOS_EXP } from "./experienciaExcel.js";

const H = (k) => CAMPOS_EXP.find((f) => f.key === k).h;
const d = (y, m, dd) => new Date(y, m - 1, dd, 12);
// Formato del archivo: encabezados en la fila 10, columna "No." al inicio y TIPO sin encabezado después de CONTRATO.
const enc = ["No.", ...CAMPOS_EXP.filter((f) => !["fic", "rete"].includes(f.key)).map((f) => (f.key === "tipo" ? null : f.h))];
const encOT = enc.map((h) => h); enc.splice(enc.indexOf(H("fechaInicio")), 0, "FIC"); encOT.splice(encOT.indexOf(H("fechaInicio")), 0, "RETE - GARANTÍA");
const fila = (hdr, o) => hdr.map((h, i) => (h === null ? o.TIPO ?? null : o[h] ?? (i === 0 ? null : null)));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Año", "Salario Mínimo"], [2024, 1300000], [2026, 1750905]]), "SMMLV");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...Array(9).fill([]), enc,
  fila(enc, { CONTRATISTA: "ELECINST S.A.S", [H("contrato")]: "CO No. 005", OBJETO: "Mano de obra", TIPO: "---", [H("valor")]: 2600000, FIC: 0, [H("fechaInicio")]: d(2024, 7, 2), [H("fechaFin")]: d(2024, 9, 30), [H("estado")]: "EN LIQUIDACIÓN" }),
  fila(enc, { CONTRATISTA: "ELECINST S.A.S", [H("contrato")]: "CO No. 005", OBJETO: "Adicional de tiempo", TIPO: "OTROSÍ No. 1", [H("valor")]: 0, [H("fechaInicio")]: d(2024, 7, 2), [H("fechaFin")]: d(2025, 3, 31) }),
]), "GENERAL ");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...Array(9).fill([]), encOT,
  fila(encOT, { CONTRATISTA: "ICOMORA", [H("contrato")]: "OT No. 011", OBJETO: "Urbanismo", [H("rete")]: 0.05, [H("valor")]: 100, [H("fechaInicio")]: d(2026, 6, 30), [H("fechaFin")]: d(2026, 8, 30) }),
]), "ORDEN DE TRABAJO");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[null], ["ELECINST S.A.S", "901"]]), "Hoja1");

const r = leerCuadro(XLSX.write(wb, { type: "array", bookType: "xlsx" }), EXPERIENCIA);
assert.deepEqual(r.smmlv, { 2024: 1300000, 2026: 1750905 }, "lee la tabla SMMLV");
assert.deepEqual(r.hojas, ["GENERAL", "ORDEN DE TRABAJO"]);
assert.equal(r.filas.length, 3);
assert.equal(r.filas[1].tipo, "OTROSÍ No. 1", "TIPO sin encabezado = columna después de CONTRATO");
assert.equal(r.filas[0].fic, 0); assert.equal(r.filas[2].rete, 0.05);
assert.ok(!r.avisos.some((a) => /faltan/.test(a)), "FIC/RETE opcionales no generan avisos: " + r.avisos);
const cs = agruparContratos(r.filas);
assert.equal(cs.length, 2);
assert.equal(cs[0].fechaFinVigente, "2025-03-31", "otrosí de tiempo amplía la fecha");
assert.equal(EXPERIENCIA.grupo(cs[0]), "ELECINST S.A.S");
const smm = CAMPOS_EXP.find((f) => f.key === "smmlv");
assert.equal(valorCalc(smm, cs[0].filas[0], { hoy: 0, smmlv: r.smmlv }), "2.00", "valor / SMMLV del año de terminación");
assert.equal(valorCalc(CAMPOS_EXP.find((f) => f.key === "meses"), cs[0].filas[0], {}), "3.2", "meses = días / 28");

// Export: FIC solo en GENERAL, RETE solo en ORDEN DE TRABAJO, hoja SMMLV, y se vuelve a leer igual.
const out = construirLibro(cs, { smmlv: r.smmlv }, EXPERIENCIA);
assert.deepEqual(out.SheetNames, ["GENERAL", "ORDEN DE TRABAJO", "SMMLV"]);
const hdr = (n) => XLSX.utils.sheet_to_json(out.Sheets[n], { header: 1 })[0];
assert.ok(hdr("GENERAL").includes("FIC") && !hdr("GENERAL").includes(H("rete")));
assert.ok(hdr("ORDEN DE TRABAJO").includes(H("rete")) && !hdr("ORDEN DE TRABAJO").includes("FIC"));
assert.ok(out.Sheets.GENERAL.L2?.f?.includes("SMMLV!") || Object.values(out.Sheets.GENERAL).some((c) => c?.f?.includes("SMMLV!")), "fórmula SMMLV");
const r2 = leerCuadro(XLSX.write(out, { type: "array", bookType: "xlsx" }), EXPERIENCIA);
assert.deepEqual(agruparContratos(r2.filas).map((c) => c.filas), cs.map((c) => c.filas), "re-import = mismo contenido");

// Archivo real (opcional)
const real = process.argv[2];
if (real) {
  const rr = leerCuadro(fs.readFileSync(real), EXPERIENCIA);
  const cr = agruparContratos(rr.filas);
  console.log(`real: ${rr.filas.length} filas, ${cr.length} contratos, hojas ${rr.hojas.join(" / ")}, SMMLV ${Object.keys(rr.smmlv || {}).length} años`);
  console.log("avisos:", rr.avisos);
  console.log("contratistas:", [...new Set(cr.map(EXPERIENCIA.grupo))].length, "tipos:", [...new Set(rr.filas.map((f) => f.tipo ?? "(vacío)"))].join(" | "));
  assert.ok(cr.length > 50 && rr.smmlv);
}
console.log("experienciaExcel.check OK");
