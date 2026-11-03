// Prueba: node src/cxpConciliacion.check.js [lutecWO.xlsx proveedor.xls [aptoLista.xlsx]]
// aptoLista: cualquier libro con el listado de cruce apto (o CONCILIACION.xlsx: hoja "CARTERA NACIONAL", columnas A y B)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerCartera } from "./carteraExcel.js";
import { leerEstadoProveedor, conciliar, puente, resumenConc, compararConciliaciones, libroConciliacionCxp, nitKey, claveFila, firmaDe, estadoRev, paresDe, aMapa, agruparLutec, CATS, TOLERANCIA } from "./cxpConciliacion.js";

const libro = (aoa, hoja = "Sheet1") => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), hoja); return XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { cellDates: true }); };

// ─── leerCartera con fila "Proveedor" ───
const H = ["Nombres_Etiqueta", "Nombres", "Identificacion", "Sucursal", "Dirección", "Vendedor", "Doc", "Num", "Fecha", "Fecha Vence", "Valor Total", "NumDias"];
const f = (o) => H.map((h) => o[h] ?? null);
const wo = libro([["GRUPO LUTEC"], ["Estado de Cuenta 30-60-90 con fecha de corte 28/10/2026 "], [], H,
  f({ Nombres_Etiqueta: "Proveedor", Nombres: "NACIONAL H.H.", Identificacion: "NIT 830054002 - 8", Dirección: "CLL 1", Doc: "CREM", Num: 100, "Valor Total": 1000, NumDias: 5 }),
  f({ Doc: "CREM", Num: "101", "Valor Total": 2000, NumDias: 5 }), // ok (dif 500)
  f({ Doc: "CREM", Num: "102", "Valor Total": 5000, NumDias: 5 }), // dif 2000
  f({ Doc: "CREM", Num: "103", "Valor Total": 7000, NumDias: 5 }), // apto
  f({ Doc: "CREM", Num: "104", "Valor Total": 900, NumDias: 5 }), // solo Lutec (parte repetida)
  f({ Doc: "DMP", Num: "104", "Valor Total": 100, NumDias: 5 }), // repetido: se suma → 1000
  f({ Doc: "CREM", Num: "105", "Valor Total": 53550000, NumDias: 5 }), // abono del proveedor
  f({ Doc: "CREM", Num: "106", "Valor Total": 9000000, NumDias: 5 }), // dif 1.000.000
  f({ Doc: "CREM", Num: "107", "Valor Total": 620500, NumDias: 5 }), // solo Lutec ≈ prov 996
  f({ Num: "Total general", "Valor Total": 63186500 }),
]);
const L = leerCartera(wo);
assert.equal(Object.keys(L.facturas).length, 9);
assert.equal(L.total, 63186500); // 1000+2000+5000+7000+900+100+53550000+9000000+620500
assert.equal(Object.values(L.facturas)[0].cli, "NACIONAL H.H.");
assert.equal(nitKey("NIT 830054002 - 8"), "830054002");
assert.equal(nitKey("", "A.B/C"), "A_B_C");

// ─── leerEstadoProveedor: metadatos arriba, números como texto, fechas mixtas, fila Total ───
const prov = libro([["NACIONAL"], ["INFORME"], ["Socio de Negocio", "NIT"], ["Factura"],
  ["Documento", "Fecha", "Plazo", "Fecha Venc.", "Dias Ven", "Importe Original", "Saldo x Vencer", "0 - 30"],
  ["100", "02/09/2026", "45 Días", new Date(Date.UTC(2026, 9, 17, 5)), 11, "1000.00", "1000.00", "1000.00"],
  ["101", "02/09/2026", "45 Días", "17/10/2026", 11, "2500", "2500", "2500"],
  ["102", "02/09/2026", "45 Días", "17/10/2026", 11, "3000", "3000", "3000"],
  ["105", "02/09/2026", "45 Días", "17/10/2026", 11, "53550000", "37485000", "37485000"],
  ["106", "02/09/2026", "45 Días", "17/10/2026", 11, "8000000", "8000000", "8000000"],
  ["996", "02/09/2026", "45 Días", "17/10/2026", 11, "620000", "620000", "620000"],
  ["Total Importe Original", 1, 2, 3, 0, 0, 0, 0],
]);
const P = leerEstadoProveedor(prov);
assert.deepEqual(Object.keys(P.facturas), ["100", "101", "102", "105", "106", "996"]);
assert.equal(P.total, 1000 + 2500 + 3000 + 37485000 + 8000000 + 620000);
assert.deepEqual([P.facturas["100"].fecha, P.facturas["100"].vence, P.facturas["101"].vence, P.facturas["105"].original], ["2026-09-02", "2026-10-17", "2026-10-17", 53550000]);
assert.deepEqual(P.mapeo, { num: "Documento", saldo: "Saldo x Vencer", fecha: "Fecha", vence: "Fecha Venc.", original: "Importe Original", dias: "Dias Ven" });
// formato desconocido → pide mapeo; con mapeo funciona; el guardado se reutiliza
const raro = libro([["Proveedor X"], ["Ref", "Monto", "Obs"], ["A1", 100, "x"], ["A2", "200,50", "y"]]);
let err; try { leerEstadoProveedor(raro); } catch (e) { err = e; }
assert.deepEqual(err.cabeceras, ["Ref", "Monto", "Obs"]);
const R = leerEstadoProveedor(raro, { num: "Ref", saldo: "Monto" });
assert.deepEqual([R.facturas.A1.saldo, R.facturas.A2.saldo, R.total], [100, 200.5, 300.5]);
assert.equal(leerEstadoProveedor(prov, { num: "Inexistente", saldo: "Otro" }).total, P.total); // mapeo viejo → alias
// lista pelada de dos columnas (cruce apto)
const apto = leerEstadoProveedor(libro([["FACTURAS CRUCE APTO"], [103, 7000], [999, 1], [998, 2], [997, 3]]));
assert.deepEqual(Object.keys(apto.facturas), ["103", "999", "998", "997"].sort());
assert.equal(apto.facturas["103"].saldo, 7000);

// ─── conciliar ───
const filas = conciliar({ lutec: L.facturas, proveedor: P.facturas, apto: apto.facturas });
const cat = (n) => filas.find((x) => x.num === n);
assert.equal(TOLERANCIA, 1000);
assert.deepEqual(["100", "101"].map((n) => cat(n).categoria), ["ok", "ok"]); // dif 0 y -500
assert.equal(cat("102").categoria, "dif"); assert.equal(cat("102").dif, 2000);
assert.equal(cat("103").categoria, "apto");
assert.equal(cat("104").categoria, "soloL"); assert.equal(cat("104").valorLutec, 1000); assert.ok(cat("104").repetidoLutec);
assert.equal(cat("996").categoria, "soloP"); assert.equal(cat("996").valorLutec, null);
assert.deepEqual(["999", "998", "997"].map((n) => cat(n).categoria), ["soloP", "soloP", "soloP"]); // apto que Lutec no tiene
assert.match(cat("105").sugerencia, /abono del proveedor/);
assert.match(cat("107").sugerencia, /996/); assert.match(cat("996").sugerencia, /107/); // solo Lutec ≈ solo proveedor
assert.equal(cat("106").sugerencia, ""); // dif 1.000.000 sin par
// apto con diferencia mayor a la tolerancia
const f2 = conciliar({ lutec: L.facturas, proveedor: {}, apto: { 103: { saldo: 1000 } } });
assert.equal(f2.find((x) => x.num === "103").categoria, "apto"); assert.match(f2.find((x) => x.num === "103").sugerencia, /apto/);
// puente exacto y resumen
const pu = puente(filas);
assert.ok(pu.cuadra); assert.equal(pu.saldoLutec, L.total); assert.equal(pu.saldoProv, P.total);
assert.ok(Math.abs(pu.saldoProv + pu.diferencias + pu.apto + pu.soloLutec + pu.soloProv - pu.saldoLutec) < 0.01);
const rs = resumenConc(filas);
assert.equal(rs.nDocs, filas.length); assert.equal(CATS.reduce((s, [k]) => s + rs.porCat[k].n, 0), filas.length);
assert.equal(rs.dif, L.total - P.total);
// comparar
const act = filas.map((x) => (x.num === "102" ? { ...x, categoria: "ok" } : x)).filter((x) => x.num !== "104").concat([{ ...filas[0], num: "NUEVA", categoria: "soloL" }]);
const cmp = compararConciliaciones(filas, act);
assert.deepEqual(cmp.map((x) => [x.num, x.cambio]).sort(), [["102", "Cambió de categoría"], ["104", "Se resolvió"], ["NUEVA", "Entró"]]);
assert.equal(compararConciliaciones(null, act).length, act.length); // sin anterior: todo entra
assert.deepEqual(conciliar({ lutec: {}, proveedor: {}, apto: {} }), []);
assert.equal(libroConciliacionCxp(XLSX, { nombre: "N", fecha: "2026-10-28", filas, resumen: rs }).SheetNames.length, 2 + CATS.length);

// ─── emparejar a mano / separar ───
const cats = (fl) => Object.fromEntries(CATS.map(([k]) => [k, fl.filter((x) => x.categoria === k).length]));
const base0 = cats(filas);
// typo: Lutec 107 (620.500) ↔ proveedor 996 (620.000)
const fm = conciliar({ lutec: L.facturas, proveedor: P.facturas, apto: apto.facturas }, { 107: "996" });
const m107 = fm.find((x) => x.num === "107");
assert.deepEqual([m107.categoria, m107.numProv, m107.manual, m107.saldoProv, m107.dif], ["ok", "996", true, 620000, 500]);
assert.ok(!fm.some((x) => x.categoria === "soloP" && x.num === "996")); // el 996 ya no es Solo proveedor
assert.deepEqual([cats(fm).ok, cats(fm).soloL, cats(fm).soloP], [base0.ok + 1, base0.soloL - 1, base0.soloP - 1]);
assert.ok(puente(fm).cuadra); assert.equal(puente(fm).saldoProv, P.total); assert.equal(puente(fm).saldoLutec, L.total);
assert.deepEqual(cat("107").sugPar, { l: "107", p: "996" }); assert.deepEqual(cat("996").sugPar, { l: "107", p: "996" });
assert.equal(fm.find((x) => x.num === "107").sugerencia, ""); // ya no hace falta sugerir
// a un número solo de apto: pasa a "apto"
const fa = conciliar({ lutec: L.facturas, proveedor: P.facturas, apto: apto.facturas }, { 104: "999" });
assert.deepEqual([fa.find((x) => x.num === "104").categoria, fa.find((x) => x.num === "104").numProv], ["apto", "999"]);
assert.ok(!fa.some((x) => x.num === "999")); assert.ok(puente(fa).cuadra);
// destino inexistente o ya usado por otra pareja manual: se ignora
assert.equal(conciliar({ lutec: L.facturas, proveedor: P.facturas }, { 107: "ZZZ" }).find((x) => x.num === "107").categoria, "soloL");
const dup = conciliar({ lutec: L.facturas, proveedor: P.facturas }, { 107: "100", 104: "100" });
assert.equal(dup.filter((x) => x.manual).length, 1); assert.ok(puente(dup).cuadra);
// la pareja manual toma el 101 del proveedor: el 101 de Lutec (mismo número) queda Solo Lutec, sin duplicar
const rob = conciliar({ lutec: L.facturas, proveedor: P.facturas }, { 107: "101" });
assert.equal(rob.find((x) => x.num === "101").categoria, "soloL"); assert.ok(puente(rob).cuadra);
// separar un OK: +1 Solo Lutec, +1 Solo proveedor, mismo número en ambas
const fs = conciliar({ lutec: L.facturas, proveedor: P.facturas, apto: apto.facturas }, { 100: "" });
assert.deepEqual([cats(fs).ok, cats(fs).soloL, cats(fs).soloP], [base0.ok - 1, base0.soloL + 1, base0.soloP + 1]);
assert.deepEqual(fs.filter((x) => x.num === "100").map((x) => x.categoria).sort(), ["soloL", "soloP"]);
assert.ok(puente(fs).cuadra); assert.equal(puente(fs).saldoProv, P.total);
assert.ok(!/100/.test(fs.find((x) => x.num === "100" && x.categoria === "soloL").sugerencia)); // no sugiere re-emparejar lo separado
// compararConciliaciones distingue las dos filas de un mismo número
assert.equal(compararConciliaciones(fs, fs).length, 0);
// ─── revisión ───
assert.equal(claveFila({ num: "A.1/2[3]", categoria: "ok" }), "A_1_2_3_"); assert.equal(claveFila({ num: "99", categoria: "soloP" }), "P_99");
const f100 = cat("100"), rec = { estado: "aprobado", firma: firmaDe(f100) };
assert.deepEqual([estadoRev(f100, undefined), estadoRev(f100, rec), estadoRev({ ...f100, saldoProv: 1 }, rec), estadoRev(f100, { nota: "x" })], ["pendiente", "aprobado", "cambio", "pendiente"]);
assert.notEqual(firmaDe(f100), firmaDe(fm.find((x) => x.num === "107"))); // cambiar la pareja invalida la aprobación
assert.deepEqual(paresDe({ 107: { par: "996" }, 100: { par: "" }, 101: { estado: "aprobado" } }, L.facturas), { 100: "", 107: "996" });
assert.deepEqual(paresDe(undefined, L.facturas), {});
// fuentes guardadas (arrays) → mismo resultado que con los objetos
const rt = (x) => JSON.parse(JSON.stringify(Object.values(x)));
assert.deepEqual(conciliar({ lutec: aMapa(rt(agruparLutec(L.facturas))), proveedor: aMapa(rt(P.facturas)), apto: aMapa(rt(apto.facturas)) }, { 107: "996" }), fm);
const lib = libroConciliacionCxp(XLSX, { nombre: "N", fecha: "2026-10-28", filas: fm, resumen: resumenConc(fm), revision: () => ["Aprobado", "ok", "Ana", "996 (manual)"] });
assert.equal(lib.Sheets.Todas["K1"].v, "Revisión"); assert.equal(lib.Sheets.Todas["N2"].v, "996 (manual)");
console.log("OK sintético");

// ─── archivos reales ───
const [pl, pp, pa] = process.argv.slice(2);
if (pl && pp) {
  const rd = (x) => XLSX.read(readFileSync(x), { cellDates: true });
  const Lr = leerCartera(rd(pl)), Pr = leerEstadoProveedor(rd(pp));
  let Ap = {};
  if (pa) { // CONCILIACION.xlsx: hoja CARTERA NACIONAL, columnas A (num) y B (valor), solo filas numéricas
    const w = rd(pa), a = XLSX.utils.sheet_to_json(w.Sheets["CARTERA NACIONAL"] || w.Sheets[w.SheetNames[0]], { header: 1, raw: true, defval: null });
    for (const r of a) if (typeof r[0] === "number" && typeof r[1] === "number") Ap[String(r[0])] = { num: String(r[0]), saldo: r[1] };
  }
  const fl = conciliar({ lutec: Lr.facturas, proveedor: Pr.facturas, apto: Ap }), r = resumenConc(fl), pr = puente(fl);
  const cnt = (k) => r.porCat[k].n;
  console.log("OK", cnt("ok"), "Con diferencia", cnt("dif"), "Cruce apto", cnt("apto"), "Solo Lutec", cnt("soloL"), "Solo proveedor", cnt("soloP"));
  console.log("valor por categoría", CATS.map(([k, n]) => `${n}=${r.porCat[k].valor.toFixed(2)}`).join(" · "));
  console.log("Lutec total", r.lutec.toFixed(2), "(Total general", Lr.totalGeneral, ") · proveedor", r.prov.toFixed(2), "· repetidos Lutec", fl.filter((x) => x.repetidoLutec).map((x) => x.num).join(","));
  console.log("puente", Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, typeof v === "number" ? +v.toFixed(2) : v])));
  console.log("sugerencias:"); for (const x of fl.filter((x) => x.sugerencia)) console.log(" ", x.num, x.categoria, x.dif?.toFixed(2) ?? x.valorLutec ?? x.saldoProv, "→", x.sugerencia);
  assert.ok(pr.cuadra);
  // con pares vacíos nada cambia; separar un OK: +1 Solo Lutec, +1 Solo proveedor, el puente sigue cuadrando
  assert.deepEqual(conciliar({ lutec: Lr.facturas, proveedor: Pr.facturas, apto: Ap }, {}), fl);
  const ok1 = fl.find((x) => x.categoria === "ok"), sep = conciliar({ lutec: Lr.facturas, proveedor: Pr.facturas, apto: Ap }, { [ok1.num]: "" }), rs2 = resumenConc(sep);
  assert.deepEqual([rs2.porCat.ok.n, rs2.porCat.soloL.n, rs2.porCat.soloP.n], [cnt("ok") - 1, cnt("soloL") + 1, cnt("soloP") + 1]);
  assert.ok(puente(sep).cuadra); assert.equal(rs2.prov, r.prov);
  console.log("OK separar", ok1.num);
}
