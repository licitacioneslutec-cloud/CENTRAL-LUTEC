// Prueba: node src/carteraExcel.check.js [corteAnterior.xlsx corteActual.xlsx]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerCartera, rango, RANGOS, resumenCorte, compararCortes, libroComparacion, leerBanco, clienteDe, sugerir, tipoDe, aliasKey, libroConciliacion } from "./carteraExcel.js";

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
const filas = ks.map((k) => ({ ...r.facturas[k], k }));
assert.deepEqual(libroComparacion(XLSX, { fecha: "2026-10-22", fechaAnt: null, resumen: rs, comp: c, todas: filas, filtro: filas.slice(0, 1) }).SheetNames.slice(5), ["Todas", "Filtro"]);

// ─── Cruce con banco ───
const HB = ["Fecha de Sistema", "Descripción motivo", "Transacción", "Oficina de Recaudo", "Valor Total", "RC", "Fin de la transacción", "Tercero"];
const wsB = XLSX.utils.aoa_to_sheet([HB,
  ["22/10/2026", "Abono ACH 8001852951 AMARILO S A S", "Nota Crédito", "ACH", 1000, 1, "cartera", "Amarilo S.A.S."],
  [d(2026, 10, 21), "Abono 2", "Nota Crédito", "ACH", 2000, 2, "ANTICIPO", null],
  [46317, "Abono 3", "Nota Crédito", "ACH", 3000, 3, null, null], // serial Excel
  ["22/10/2026", "Cobro IVA", "Nota Débito", "ACH", 5, null, null, null],
  ["22/10/2026", "Abono ACH 8001852951 AMARILO S A S", "Nota Crédito", "ACH", 1000, 1, "CARTERA", "AMARILO"], // duplicado exacto → #2
]);
const wbB = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbB, wsB, "Movimientos1");
const bm = leerBanco(XLSX.read(XLSX.write(wbB, { type: "array", bookType: "xlsx" }), { cellDates: true }));
const bl = Object.values(bm);
assert.equal(bl.length, 4); assert.equal(new Set(Object.keys(bm)).size, 4);
assert.ok(Object.keys(bm).every((k) => !/[.#$/[\]]/.test(k)), "ids seguros para RTDB");
assert.deepEqual(bl.map((m) => m.fecha), ["2026-10-22", "2026-10-21", "2026-10-22", "2026-10-22"]); // serial 46317 = 22/10/2026
assert.deepEqual([bl[0].fin, bl[0].nitDesc, bl[2].fin], ["CARTERA", "8001852951", ""]);
assert.throws(() => leerBanco(libro([["otro"], ["x"]])), /extracto/);

const cls = [{ nit: "NIT 800185295 - 1", cli: "AMARILO S.A.S" }, { nit: "NIT 900 - 1", cli: "CONSTRUCTORA COLPATRIA S.A.S" }];
assert.deepEqual(clienteDe({ tercero: "Amarilo SAS", nitDesc: "" }, cls), { nit: cls[0].nit, por: "nombre" });
assert.deepEqual(clienteDe({ tercero: "", nitDesc: "8001852951" }, cls), { nit: cls[0].nit, por: "nit" }); // NIT + dígito de verificación
assert.deepEqual(clienteDe({ tercero: "FIDUCIARIA X", nitDesc: "" }, cls, { [aliasKey("Fiduciaria X")]: cls[1].nit }), { nit: cls[1].nit, por: "alias" });
assert.equal(clienteDe({ tercero: "OTRO", nitDesc: "" }, cls), null);

const F = (k, valor, fecha, dias = 50, doc = "FV") => ({ k, doc, valor, fecha, dias });
const fs = [F("a", 1000000, "2026-01-01"), F("b", 2500000, "2026-02-01"), F("c", 700000, "2026-03-01"), F("n", -100000, "2026-03-05", 10, "NC"), F("x", 9e6, "2026-04-01")];
let s = sugerir(3500000, fs, new Set(["a", "b"]));
assert.equal(s[0].tipo, "exacto"); assert.deepEqual(s[0].claves.sort(), ["a", "b"]); assert.equal(s[0].diferencia, 0);
s = sugerir(3500000 * 0.96, fs); // retención 4 %
assert.deepEqual([s[0].tipo, s[0].claves.sort().join()], ["retención", "a,b"]); assert.ok(Math.abs(s[0].pctRetencion - 4) < 1e-6);
s = sugerir(2400000, fs); // 2.5M + NC(-100k)
assert.deepEqual([s[0].tipo, s[0].claves.sort().join()], ["exacto", "b,n"]);
s = sugerir(5e6, fs); // nada suma ≈5M → abono contra la factura mayor
assert.deepEqual([s[0].tipo, s[0].claves], ["abono", ["x"]]);
assert.equal(tipoDe(100000, 150000), "otro");
assert.equal(libroConciliacion(XLSX, [{ id: "1", ...bl[0], c: { estado: "conciliado", suma: 1000, diferencia: 0 } }]).SheetNames[0], "Conciliación");
console.log("OK sintético");

const [pa, pb, pc] = process.argv.slice(2);
if (pa && pb) {
  const [A, B] = [pa, pb].map((f) => leerCartera(XLSX.read(readFileSync(f), { cellDates: true })));
  for (const [n, x] of [["ant", A], ["act", B]]) console.log(n, x.fechaCorte, Object.keys(x.facturas).length, "docs", x.total.toFixed(2), "vs Total general", x.totalGeneral, Math.abs(x.total - x.totalGeneral) <= 1 ? "OK" : "DIFIERE");
  const k = compararCortes(A.facturas, B.facturas);
  console.log("nuevas/salieron/cambioValor/cambioRango:", k.nuevas.length, k.salieron.length, k.cambioValor.length, k.cambioRango.length, k.cascada);
  if (pc) { // extracto: cruza contra el corte más reciente (referencia; los pagos anteriores ya no estarán en cartera)
    const todos = Object.values(leerBanco(XLSX.read(readFileSync(pc), { cellDates: true }))), mv = todos.filter((m) => m.fin === "CARTERA");
    const cl = Object.entries(Object.values(B.facturas).reduce((u, f) => ({ ...u, [f.nit]: f.cli }), {})).map(([nit, cli]) => ({ nit, cli }));
    const det = mv.map((m) => ({ m, c: clienteDe(m, cl) }));
    console.log("notas crédito:", todos.length, "· CARTERA:", mv.length, "· con cliente detectado:", det.filter((x) => x.c).length, `(${((det.filter((x) => x.c).length / (mv.length || 1)) * 100).toFixed(0)}%)`, "· por", ["nombre", "nit"].map((p) => p + "=" + det.filter((x) => x.c?.por === p).length).join(" "));
    const conSug = det.filter((x) => x.c).map(({ m, c }) => ({ m, s: sugerir(m.valor, Object.entries(B.facturas).filter(([, f]) => f.nit === c.nit).map(([k, f]) => ({ ...f, k })), new Set()) })).filter((x) => x.s.length);
    console.log("con sugerencias:", conSug.length);
    for (const { m, s } of conSug.slice(0, 3)) console.log(" ", m.fecha, m.tercero, m.valor, "→", s[0].tipo, s[0].claves.length, "docs", "dif", s[0].diferencia.toFixed(0), s[0].pctRetencion.toFixed(2) + "%");
  }
}
