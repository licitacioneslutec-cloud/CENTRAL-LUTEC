// Prueba: node src/cruceWO.check.js [reporteWO.xlsx|.xlk [respaldoFacturas.xlsx]]
// respaldoFacturas: export del módulo (columnas nERP, nitEmisor, nombreEmisor, total, ...); sustituye a RTDB `facturas`, id = n.º de fila
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { normDoc, fechaISO, leerComprasWO, cruzar, resumenCruce, libroCruceWO, firmaDe, estadoRev, paresDe, CATS, TOLERANCIA } from "./cruceWO.js";

const libro = (aoa) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "ExportarAExcel"); return XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { cellDates: true }); };

// ─── normalización ───
assert.deepEqual(["21029", 21029, "CREM  123", "dmp 777", "FC PN 963", "NCPR  334", "AJ 5", "CR21029", "  ", "pendiente"].map(normDoc), ["CR 21029", "CR 21029", "CREM 123", "DMP 777", "FC 963", "NCP 334", "AJ 5", "CR 21029", "", "PENDIENTE"]);
assert.deepEqual(["14-08-2026", "5/9/2026", "2026-10-03T10:00", "", null, "x"].map(fechaISO), ["2026-08-14", "2026-09-05", "2026-10-03", "", "", ""]);

// ─── lectura: título, encabezado por alias, fila Total, serial de fecha ───
const wo = libro([["GRUPO LUTEC S.A.S"], ["Compras por Documento entre  01/10/2026 Y 31/10/2026"], ["CC/Nit", "Proveedor", "Fecha", "Documento", null, "Compra Bruta", "IVA", "Valor Total"],
  ["111", "UNO SAS", 46300, 21001, 21001, 100, 19, 119],
  ["222", "DOS SAS", 46301, "FC PN 963", null, 200, 0, 200],
  ["333", "TRES SAS", 46302, "DMP  777", null, -500, 0, -500],
  ["444", "CUATRO SAS", 46303, "NCPR  334", null, -50, 0, -50],
  ["555", "CINCO SAS", 46304, 21005, null, 1000, 0, 1000],
  ["666", "SEIS SAS", 46305, 21006, null, 3000, 0, 3000],
  ["777", "SIETE SAS", 46306, 21007, null, 4000, 0, 4000],
  ["Total", null, null, null, null, null, null, 99999]]);
const W = leerComprasWO(wo);
assert.deepEqual([W.mes, W.desde, W.hasta, W.docs.length, W.total], ["2026-10", "2026-10-01", "2026-10-31", 7, 119 + 200 - 500 - 50 + 1000 + 3000 + 4000]);
assert.deepEqual([W.docs[0].doc, W.docs[1].doc, W.docs[3].doc, W.docs[0].fecha, W.docs[0].nit], ["CR 21001", "FC 963", "NCP 334", "2026-10-05", "111"]);
assert.throws(() => leerComprasWO(libro([["a", "b"], [1, 2]])), /Compras por Documento/);

// ─── cruce ───
const fa = (id, nERP, nit, total, extra = {}) => ({ id, nERP, nitEmisor: nit, nombreEmisor: "P" + nit, total, fechaEmision: "14-10-2026", ...extra });
const F = [
  fa("a", "CR 21001", "111", 5000), // dif de valor
  fa("b", "FC 963", "222", 200.5), // ok (±tolerancia)
  fa("c", "DMP 777", "333", 500), // ok por valor absoluto
  fa("d", "NCP 334", "999", 50), // NIT distinto → dif
  fa("e", "CR 99999", "555", 1000), // noWO con doc solo WO del mismo NIT y valor → sugerencia
  fa("f", "", "666", 3000), // sinERP con sugerencia
  fa("g", "", "888", 10), // sinERP sin sugerencia
  fa("h", "CR 21001", "111", 119), // N.º ERP repetido: la buena (valor 119) gana, la "a" queda sin pareja
  fa("i", "CR 12345", "111", 5, { fechaEmision: "01-03-2026" }), // marzo: fuera de la piscina
  fa("j", "", "111", 5, { fechaEmision: "" }), // sin fecha: entra
  fa("k", "", "111", 5, { fechaEmision: "20-09-2026" }), // mes anterior: entra
  fa("l", "CR 21007", "777", 4000, { fechaEmision: "01-03-2026" }), // tiene pareja: entra aunque sea vieja
];
const cat = (fl, id) => fl.find((x) => x.id === id)?.categoria;
const fl = cruzar(F, W.docs, W.mes);
assert.deepEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map((i) => cat(fl, i)), ["noWO", "ok", "ok", "dif", "noWO", "sinERP", "sinERP", "ok", undefined, "sinERP", "sinERP", "ok"]);
assert.equal(fl.find((x) => x.id === "d").sugerencia.slice(0, 12), "NIT distinto");
assert.match(fl.find((x) => x.id === "a").sugerencia, /repetido/);
assert.equal(fl.find((x) => x.id === "e").sugDoc, "CR 21005"); assert.match(fl.find((x) => x.id === "e").sugerencia, /mal digitado/);
assert.equal(fl.find((x) => x.id === "f").sugDoc, "CR 21006");
assert.equal(fl.find((x) => x.id === "g").sugDoc, undefined);
assert.deepEqual(fl.filter((x) => x.categoria === "soloWO").map((x) => x.doc).sort(), ["CR 21005", "CR 21006"]);
assert.equal(fl.find((x) => x.doc === "CR 21005" && x.categoria === "soloWO").sugId, "e");
const r = resumenCruce(fl, W.docs);
assert.equal(CATS.reduce((s, [k]) => s + r.porCat[k].n, 0), fl.length); assert.equal(r.wo, W.total); assert.equal(r.nPortal, fl.length - 2);
assert.equal(TOLERANCIA, 1000);
// emparejar a mano: e ↔ CR 21005 (ok), separar h (el doc 21001 pasa a la "a" por número igual → dif de valor)
const fm = cruzar(F, W.docs, W.mes, { e: "CR 21005", h: "" });
assert.deepEqual([cat(fm, "e"), fm.find((x) => x.id === "e").manual, cat(fm, "h"), cat(fm, "a")], ["ok", true, "noWO", "dif"]);
assert.equal(cruzar(F, W.docs, W.mes, { e: "NOEXISTE" }).find((x) => x.id === "e").categoria, "noWO"); // doc inexistente se ignora
assert.equal(cruzar(null, W.docs, W.mes).filter((x) => x.categoria === "soloWO").length, 7); assert.deepEqual(cruzar([], [], "2026-10"), []);
// ─── revisión ───
const fb = fl.find((x) => x.id === "b"), rec = { estado: "aprobado", firma: firmaDe(fb) };
assert.deepEqual([estadoRev(fb, undefined), estadoRev(fb, rec), estadoRev({ ...fb, valorWO: 1 }, rec), estadoRev(fb, { nota: "x" })], ["pendiente", "aprobado", "cambio", "pendiente"]);
assert.deepEqual(paresDe({ e: { par: "CR 21005" }, h: { par: "" }, b: { estado: "aprobado" } }), { e: "CR 21005", h: "" });
assert.deepEqual(paresDe(undefined), {});
const lib = libroCruceWO(XLSX, { mes: "2026-10", filas: fl, resumen: r, revision: () => ["Aprobado", "n", "Ana"] });
assert.equal(lib.SheetNames.length, 2 + CATS.length); assert.equal(lib.Sheets.Todas["L1"].v, "Revisión");
console.log("OK sintético");

// ─── archivos reales ───
const [pw, pf] = process.argv.slice(2);
if (pw) {
  const Wr = leerComprasWO(XLSX.read(readFileSync(pw), { cellDates: true }));
  console.log("WO", Wr.mes, Wr.desde, Wr.hasta, "docs", Wr.docs.length, "total", Wr.total, "únicos", new Set(Wr.docs.map((d) => d.doc)).size);
  if (pf) {
    const a = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(pf), { cellDates: true }).Sheets.Facturas, { defval: "" });
    const fs = a.map((x, i) => ({ id: String(i), nERP: x.nERP, nitEmisor: x.nitEmisor, nombreEmisor: x.nombreEmisor, total: x.total, fechaEmision: x.fechaEmision, tipoDoc: x.tipoDoc, observacion: x.observacion }));
    const t0 = Date.now(), res = cruzar(fs, Wr.docs, Wr.mes), rs = resumenCruce(res, Wr.docs), cnt = (k) => rs.porCat[k].n;
    console.log("facturas", fs.length, "· con nERP", fs.filter((x) => normDoc(x.nERP)).length, "· cruce en", Date.now() - t0, "ms");
    console.log("OK", cnt("ok"), "Con diferencia", cnt("dif"), "Sin doc WO", cnt("noWO"), "Sin N.º ERP", cnt("sinERP"), "Solo WO", cnt("soloWO"));
    console.log("valor por categoría", CATS.map(([k, n]) => `${n}=${rs.porCat[k].valor.toFixed(2)}`).join(" · "), "· WO", rs.wo, "· portal", rs.portal);
    console.log("pareadas", cnt("ok") + cnt("dif"), "· sugerencias sinERP", res.filter((x) => x.categoria === "sinERP" && x.sugDoc).length, "noWO", res.filter((x) => x.categoria === "noWO" && x.sugDoc).length);
    console.log("diferencias:"); for (const x of res.filter((x) => x.categoria === "dif")) console.log(" ", x.num, x.nit, x.valorPortal, x.valorWO, x.sugerencia);
    assert.equal(rs.nDocs, res.length);
    assert.equal(new Set(res.map((x) => x.key)).size, res.length); // claves de revisión únicas
    libroCruceWO(XLSX, { mes: Wr.mes, filas: res, resumen: rs });
  }
}
