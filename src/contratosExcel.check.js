// Prueba: node src/contratosExcel.check.js
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { CAMPOS, leerCuadro, agruparContratos, construirLibro, contratoKey, esFinalizado, siguienteOrden, filaNueva, armarContrato } from "./contratosExcel.js";

const H = CAMPOS.map((f) => f.h);
const libro = (hojas) => {
  const wb = XLSX.utils.book_new();
  for (const [nombre, aoa] of hojas) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nombre);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
};
const fila = (o) => CAMPOS.map((f) => o[f.h] ?? null);
const d = (y, m, dd) => new Date(y, m - 1, dd, 12);

// Encabezado en fila 1 (con espacios finales) y en fila 10 (columna extra a la izquierda, columnas desordenadas)
const hdrFila1 = H.map((h, i) => (i === 3 ? h + " " : h));
const hdr10 = [null, ...[...H].reverse()];
const f10 = (o) => [null, ...[...H].reverse().map((h) => o[h] ?? null)];
const buf = libro([
  ["PLANTILLA", [["x"]]],
  ["SMMLV", [["x"]]],
  ["ACME ", [
    hdrFila1,
    fila({ CONTRATO: "CO No. 1", OBJETO: "Suministro", "VALOR DEL CONTRATO EJECUTADO A LA TERMINACIÓN ($)": "$ 1.500.000", "FECHA DE TERMINACIÓN mm/aaaa": d(2026, 3, 31), "PORCENTAJE DE EJECUCIÓN": 0.5, "ESTADO DE LA OBRA": "EN EJECUCIÓN", NIT: 123 }),
    fila({ CONTRATO: "CO No. 1", OBJETO: "Adicional de tiempo", TIPO: "OTROSÍ No. 1", "FECHA DE TERMINACIÓN mm/aaaa": d(2026, 9, 30), "ESTADO DE LA OBRA": "RENOVADO" }),
    fila({ CONTRATO: "CO No. 2", OBJETO: "Otro", TIPO: "---", "ESTADO DE LA OBRA": "FINALIZADO" }),
    fila({}), // vacía: se descarta
    fila({ OBJETO: "Sin numero de contrato muy largo ".repeat(3) }),
  ]],
  ["BETA", [...Array(9).fill([]), hdr10, f10({ CONTRATO: 77, OBJETO: "Obra B", "FECHA DE INICIACIÓN mm/aaaa": 46000 })]],
  ["VACIA", [["nada"]]],
]);

const r = leerCuadro(buf);
assert.deepEqual(r.hojas, ["ACME", "BETA"], "salta PLANTILLA, SMMLV y hojas sin encabezado");
assert.ok(r.avisos.some((a) => a.includes("VACIA")));
assert.equal(r.filas.length, 5, "fila vacía descartada");
const [a1, a2] = r.filas;
assert.equal(a1.valor, 1500000, "número desde texto colombiano");
assert.equal(a1.fechaFin, "2026-03-31");
assert.equal(a1.pct, 0.5);
assert.equal(a1.nit, "123");
assert.equal(a1.proyecto, undefined);
assert.equal(a2.tipo, "OTROSÍ No. 1");
const b = r.filas.find((f) => f.hoja === "BETA");
assert.equal(b.contrato, "77", "hoja con encabezado en fila 10 y columnas desordenadas");
assert.match(b.fechaInicio, /^2025-/);

const cs = agruparContratos(r.filas);
assert.equal(cs.length, 4);
const c1 = cs.find((c) => c.contrato === "CO No. 1");
assert.equal(c1.filas.length, 2, "otrosí agrupado con su contrato");
assert.equal(c1.fechaFinEfectiva, "2026-09-30", "fecha fin = la más tardía");
assert.equal(c1.estadoEfectivo, "RENOVADO");
assert.equal(c1.base.tipo, undefined);
assert.ok(esFinalizado(cs.find((c) => c.contrato === "CO No. 2").estadoEfectivo));
assert.ok(!esFinalizado("EN EJECUCION"));
const sin = cs.find((c) => c.sinContrato);
assert.ok(sin.key.startsWith("ACME|SUMINISTRO") === false && sin.key.split("|")[1].length <= 40);
assert.equal(contratoKey("A.B", { contrato: "x.y#z/1" }).match(/[.#$[\]/]/g)?.length, undefined);

// Round trip: exportar -> importar da lo mismo
const wb2 = construirLibro(cs);
assert.deepEqual(wb2.SheetNames, ["ACME", "BETA"]);
const r2 = leerCuadro(XLSX.write(wb2, { type: "array", bookType: "xlsx" }));
const strip = (fs) => fs.map(({ orden, ...x }) => x);
assert.deepEqual(strip(r2.filas), strip(r.filas), "export reimporta limpio");
assert.deepEqual(agruparContratos(r2.filas).map((c) => c.key), cs.map((c) => c.key));
const ws = wb2.Sheets.ACME;
assert.equal(ws.O2, undefined, "sin fecha inicio no hay fórmulas");

// Contratos nuevos desde el portal
const dbc = [{ hoja: "ACME", orden: 5 }, { hoja: "ACME", orden: 9 }, { hoja: "BETA", orden: 10003 }];
assert.equal(siguienteOrden(dbc, "acme"), 10, "al final de su hoja");
assert.equal(siguienteOrden(dbc, "NUEVA"), 20004, "hoja nueva: después de todo");
const fn = filaNueva({ entidad: "E", contrato: "CO 1", valor: 5 }, [{}, { tipo: "OTROSÍ No. 1" }], false);
assert.deepEqual(fn, { tipo: "OTROSÍ No. 2", entidad: "E", contrato: "CO 1" });
assert.equal(filaNueva({}, [], true).tipo, "LIQUIDACIÓN");
const nuevo = { hoja: "NUEVA", orden: 1, filas: [{ contrato: "X.1", tipo: "---" }, fn] };
assert.equal(construirLibro([armarContrato("k", "NUEVA", "X.1", 1, nuevo.filas)]).SheetNames[0], "NUEVA");

console.log("contratosExcel.check OK");
