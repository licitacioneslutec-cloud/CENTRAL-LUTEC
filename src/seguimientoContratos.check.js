// Prueba: node src/seguimientoContratos.check.js ["ruta/SEGUIMIENTO DE CONTRATOS.xlsx"]
import assert from "node:assert/strict";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { serial } from "./contratosExcel.js";
import { CAMPOS_SEG, leerSeguimiento, estadoSeg, segKey, libroSeguimiento, planCargaSeg, verFecha } from "./seguimientoContratos.js";

const H = (k) => CAMPOS_SEG.find((f) => f.key === k).h;
const d = (y, m, dd) => new Date(y, m - 1, dd, 12);
const hdr = [...CAMPOS_SEG.map((f) => f.h + " ")]; // con espacios finales, como el archivo
const fila = (o) => CAMPOS_SEG.map((f) => o[f.key] ?? null);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hdr,
  fila({ cliente: "CUSEZAR ", proyecto: "MURALES", contrato: "CO No. 6800096", tipo: "INICIAL", area: "INGENIERIA", llegada: d(2026, 10, 21), presupuesto: "N/A", firmado: d(2026, 11, 4) }),
  fila({ cliente: "AMARILO", contrato: "CO No. 117119", tipo: "OTROSÍ No. 1", llegada: d(2026, 10, 1), aprobAreas: "RECHAZADO POR ERROR DEL CLIENTE" }),
  fila({ cliente: "AMARILO", contrato: "CO No. 117119", tipo: "OTROSÍ No. 1" }),
  fila({ notificacion: d(2026, 10, 29), cliente: "MÉNSULA", proyecto: "ALTTO SALITRE" }),
  fila({}),
]), "Hoja1");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["INICIAL", "INGENIERIA"]]), "Hoja2");

const r = leerSeguimiento(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
assert.equal(r.filas.length, 4, "fila vacía descartada");
const [a, b, b2, c] = r.filas;
assert.equal(a.llegada, "2026-10-21"); assert.equal(a.presupuesto, "N/A", "texto en columna de fecha");
assert.equal(a.cliente, "CUSEZAR");
assert.equal(b.aprobAreas, "RECHAZADO POR ERROR DEL CLIENTE");
assert.equal(b2.key, b.key + "#2", "duplicado con #2");
assert.equal(c.key, segKey(c)); assert.ok(c.key.startsWith("~"), "sin número: cliente|proyecto");
assert.ok(r.avisos.some((x) => /Hoja2/.test(x)) && r.avisos.some((x) => /repetida/.test(x)));

const hoy = serial("2026-11-09");
assert.deepEqual(estadoSeg(a, hoy), { dias: 14, alarma: "FIRMADO", tiempo: 14, siguiente: H("aprobAreas") });
assert.equal(estadoSeg({ llegada: "2026-10-01" }, hoy).alarma, "A30");
assert.equal(estadoSeg({ llegada: "2026-10-20" }, hoy).alarma, "A15", "19 días");
assert.equal(estadoSeg({ llegada: "2026-10-25" }, hoy).alarma, "PROCESO", "15 días exactos no alarma");
assert.equal(estadoSeg({ llegada: "N/A" }, hoy).alarma, "SIN");
assert.equal(estadoSeg({ ...a, pasadoA: "X" }, hoy).alarma, "PASADO");
assert.equal(verFecha("2026-10-21"), "21/10/2026"); assert.equal(verFecha("N/A"), "N/A");

// Carga conserva pasadoA y orden de los existentes
const ctx = { usuario: "U", nuevoId: (() => { let i = 0; return () => "h" + i++; })() };
const up = planCargaSeg([{ ...a }], { [a.key]: { pasadoA: "CUSEZAR|X", orden: 5 } }, "f.xlsx", ctx);
assert.equal(up[`contratosSeguimiento/${a.key}`].pasadoA, "CUSEZAR|X");
assert.equal(up[`contratosSeguimiento/${a.key}`].orden, 5);
assert.equal(up[`contratosSeguimiento/${a.key}`].key, undefined);

// Export → re-import = mismos datos
const out = libroSeguimiento(r.filas);
const r2 = leerSeguimiento(XLSX.write(out, { type: "array", bookType: "xlsx" }));
const sin = (f) => { const { key, orden, ...x } = f; return x; };
assert.deepEqual(r2.filas.map(sin), r.filas.map(sin));
assert.ok(out.Sheets.Seguimiento.F2.f.includes("TODAY()"), "alarma 15 como fórmula");

const real = process.argv[2];
if (real) {
  const rr = leerSeguimiento(fs.readFileSync(real));
  const hoyR = serial(new Date().toLocaleDateString("sv"));
  console.log(`real: ${rr.filas.length} filas`, rr.avisos);
  for (const s of rr.filas) { const e = estadoSeg(s, hoyR); console.log(`  ${s.cliente} · ${s.contrato || "—"} · ${s.tipo || ""} → ${e.alarma} (${e.dias ?? "—"} d) siguiente: ${e.siguiente ?? "—"}`); }
}
console.log("seguimientoContratos.check OK");
