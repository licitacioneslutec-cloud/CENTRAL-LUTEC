// Prueba: node src/carteraExcel.check.js [corteAnterior.xlsx corteActual.xlsx]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerCartera, rango, RANGOS, resumenCorte, compararCortes, libroComparacion } from "./carteraExcel.js";

const H = ["Nombres_Etiqueta", "Nombres", "Identificacion", "EMail", "Personalizado1", "Sucursal", "Dirección", "Ciudad_", "Telefono", "Vendedor", "Doc", "Num", "Fecha", "Fecha Vence", "Valor Total", "Por Vencer", "1 A 30", "31 A 60", "61 A 90", "91 A 180", "NumDias", "181 A 360", "Más De 360"];
const fila = (o) => H.map((h) => o[h] ?? null);
const d = (y, m, dd) => new Date(Date.UTC(y, m - 1, dd, 5));
const libro = (aoa) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "ExportarAExcel"); return XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { cellDates: true }); };
const mk = (extra = []) => libro([
  ["GRUPO LUTEC S.A.S"], ["Estado de Cuenta 30-60-90 con fecha de corte 22/10/2026 "], ["Elaborado"], H,
  fila({ Nombres_Etiqueta: "Cliente", Nombres: "ACME", Identificacion: "NIT 1 - 7", Sucursal: "Principal", Dirección: "CR 1.2", Vendedor: "Ana", Doc: "FV", Num: "F 1", Fecha: d(2026, 10, 1), "Fecha Vence": "01/11/2026", "Valor Total": 100, NumDias: -10 }),
  fila({ Doc: "FV", Num: "F 2", Fecha: "02/10/2026", "Fecha Vence": "02/10/2026", "Valor Total": 50, NumDias: 20 }),
  fila({ Doc: "NC", Num: "N 1", "Valor Total": -30, NumDias: 100 }),
  fila({ Doc: "FV", Num: "F 2", "Valor Total": 5, NumDias: 20 }), // clave duplicada
  fila({ Num: "Total CR 1.2", "Valor Total": 125 }), // total: se ignora
  ...extra,
  fila({ Num: "Total general", "Valor Total": 125 }),
]);

const r = leerCartera(mk());
const ks = Object.keys(r.facturas);
assert.equal(r.fechaCorte, "2026-10-22");
assert.equal(ks.length, 4);
assert.equal(r.total, 125);
assert.equal(r.totalGeneral, 125);
assert.ok(ks.every((k) => !/[.#$/[\]]/.test(k)), "claves seguras para RTDB");
assert.equal(new Set(ks).size, 4); // duplicado F 2 con sufijo
const [f1, f2] = ks.map((k) => r.facturas[k]);
assert.deepEqual([f1.fecha, f1.vence, f1.suc, f1.ven], ["2026-10-01", "2026-11-01", "Principal", "Ana"]);
assert.deepEqual([f2.suc, f2.ven, f2.fecha], ["Principal", "Ana", "2026-10-02"]); // carry-down
assert.throws(() => leerCartera(libro([["otro"], ["x"]])), /30-60-90/);

assert.deepEqual([0, 1, 30, 31, 60, 61, 90, 91, 180, 181, 360, 361].map(rango), [RANGOS[0], "1-30", "1-30", "31-60", "31-60", "61-90", "61-90", "91-180", "91-180", "181-360", "181-360", "+360"]);
const rs = resumenCorte(r.facturas);
assert.equal(rs.total, 125); assert.equal(rs.vencido, 25); assert.equal(rs.nDocs, 4);
assert.equal(rs.porRango["91-180"], -30); assert.equal(rs.topClientes[0].cli, "ACME");

const r2 = leerCartera(mk([fila({ Doc: "FV", Num: "F 9", "Valor Total": 70, NumDias: 5 })]));
const act = { ...r2.facturas };
act[ks[0]] = { ...act[ks[0]], valor: 120, dias: 40 };
delete act[ks[1]];
const c = compararCortes(r.facturas, act);
assert.deepEqual([c.nuevas.length, c.salieron.length, c.cambioValor.length, c.cambioRango.length], [1, 1, 1, 1]);
const z = c.cascada;
assert.ok(Math.abs(z.saldoAnt + z.nuevas - z.salieron + z.ajustes - z.saldoAct) < 1e-6);
const c0 = compararCortes(null, act);
assert.equal(c0.nuevas.length, 0); assert.equal(c0.cascada.saldoAnt, c0.cascada.saldoAct);
assert.equal(libroComparacion(XLSX, { fecha: "2026-10-22", fechaAnt: "2026-10-21", resumen: rs, comp: c }).SheetNames.length, 5);
console.log("OK sintético");

const [pa, pb] = process.argv.slice(2);
if (pa && pb) {
  const [A, B] = [pa, pb].map((f) => leerCartera(XLSX.read(readFileSync(f), { cellDates: true })));
  for (const [n, x] of [["ant", A], ["act", B]]) console.log(n, x.fechaCorte, Object.keys(x.facturas).length, "docs", x.total.toFixed(2), "vs Total general", x.totalGeneral, Math.abs(x.total - x.totalGeneral) <= 1 ? "OK" : "DIFIERE");
  const k = compararCortes(A.facturas, B.facturas);
  console.log("nuevas/salieron/cambioValor/cambioRango:", k.nuevas.length, k.salieron.length, k.cambioValor.length, k.cambioRango.length, k.cascada);
}
