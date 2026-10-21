// Prueba: node src/contratosExcel.check.js
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { CAMPOS, leerCuadro, agruparContratos, construirLibro, contratoKey, esFinalizado, siguienteOrden, filaNueva, armarContrato, inferirModifica, aplicarAlias, sugerencias, planMover, unirFilas, desdeDb, etiquetaOtrosi } from "./contratosExcel.js";

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
assert.equal(a1.pct, undefined, "PORCENTAJE DE EJECUCIÓN ya no se importa");
assert.equal(a1.modifica, undefined, "la fila base no lleva modifica");
assert.equal(a1.nit, "123");
assert.equal(a1.proyecto, undefined);
assert.equal(a2.tipo, "OTROSÍ No. 1");
assert.equal(a2.modifica, "TIEMPO", "se infiere del OBJETO");
const b = r.filas.find((f) => f.hoja === "BETA");
assert.equal(b.contrato, "77", "hoja con encabezado en fila 10 y columnas desordenadas");
assert.match(b.fechaInicio, /^2025-/);

const cs = agruparContratos(r.filas);
assert.equal(cs.length, 4);
const c1 = cs.find((c) => c.contrato === "CO No. 1");
assert.equal(c1.filas.length, 2, "otrosí agrupado con su contrato");
assert.equal(c1.fechaFinVigente, "2026-09-30", "fecha fin vigente = la del último otrosí que modifica TIEMPO");
assert.equal(c1.estadoEfectivo, "RENOVADO");
assert.equal(c1.base.tipo, undefined);
assert.ok(esFinalizado(cs.find((c) => c.contrato === "CO No. 2").estadoEfectivo));
assert.ok(!esFinalizado("EN EJECUCION") && !esFinalizado("EN LIQUIDACIÓN"), "EN LIQUIDACIÓN sigue alarmando");
assert.ok(esFinalizado("Finalizado"));
const sin = cs.find((c) => c.sinContrato);
assert.ok(sin.key.startsWith("ACME|SUMINISTRO") === false && sin.key.split("|")[1].length <= 40);
assert.equal(contratoKey("A.B", { contrato: "x.y#z/1" }).match(/[.#$[\]/]/g)?.length, undefined);

// Round trip: exportar -> importar da lo mismo (una hoja por constructora)
const wb2 = construirLibro(cs);
assert.deepEqual(wb2.SheetNames, ["ACME", "BETA"]);
const bin = (wb) => XLSX.write(wb, { type: "array", bookType: "xlsx" });
const r2 = leerCuadro(bin(wb2));
const strip = (fs) => fs.map(({ orden, ...x }) => x);
assert.deepEqual(strip(r2.filas), strip(r.filas), "export reimporta limpio");
assert.deepEqual(agruparContratos(r2.filas).map((c) => c.key), cs.map((c) => c.key));
const ws = wb2.Sheets.ACME;
assert.equal(ws.O2, undefined, "sin fecha inicio no hay fórmulas");
assert.equal(ws.X1.v, "MODIFICA", "MODIFICA es la última columna");
assert.equal(ws.X3.v, "TIEMPO");
// Una sola hoja: columna HOJA al inicio y hoja "Contratos"; la hoja original sobrevive al reimportar
const wb3 = construirLibro(cs, { formato: "unica" });
assert.deepEqual(wb3.SheetNames, ["Contratos"]);
assert.equal(wb3.Sheets.Contratos.A1.v, "HOJA");
const r3 = leerCuadro(bin(wb3));
assert.deepEqual(r3.hojas, ["ACME", "BETA"]);
assert.deepEqual(strip(r3.filas), strip(r.filas), "una sola hoja reimporta igual");
// Solo el contrato general: una fila por contrato con valor/fecha/estado vigentes, tipo del base
const gen = leerCuadro(bin(construirLibro(cs, { contenido: "general" }))).filas;
assert.equal(gen.length, cs.length);
const g1 = gen.find((f) => f.contrato === "CO No. 1");
assert.equal(g1.fechaFin, "2026-09-30");
assert.equal(g1.estado, "RENOVADO");
assert.equal(g1.valor, 1500000, "sin otrosí de VALOR: el valor base");
assert.equal(g1.tipo, undefined);
assert.equal(leerCuadro(bin(construirLibro(cs, { formato: "unica", contenido: "general" }))).filas.length, cs.length);

// Modifica: inferencia sobre los OBJETO reales (sin tildes y con ellas)
const inf = (objeto, tipo = "OTROSÍ No. 1") => inferirModifica({ tipo, objeto });
for (const [o, esp] of [["ADICIONAL DE TIEMPO", "TIEMPO"], ["ADICIÓN DE TIEMPO", "TIEMPO"], ["AMPLIACIÓN DE TIEMPO", "TIEMPO"], ["ADICIONAL DE VALORES", "VALOR"],
  ["DESCONTRATACIÓN", "VALOR"], ["ADICIONAL DE TIEMPO Y VALORES", "TIEMPO Y VALOR"], ["ADICIONAL DE TIEMPO Y MAYORES CANTIDADES", "TIEMPO Y VALOR"],
  ["VALORES CON LOS QUE SE LIQUIDA", "TIEMPO Y VALOR"], ["VALORES Y FECHAS CON LOS QUE SE LIQUIDA EL CONTRATO", "TIEMPO Y VALOR"], ["", "TIEMPO Y VALOR"]]) assert.equal(inf(o), esp, o);
assert.equal(inf("ADICIONAL DE TIEMPO", "LIQUIDACIÓN"), "TIEMPO Y VALOR");
assert.equal(inf("Se liquida", "OTROSÍ"), "TIEMPO Y VALOR");

// Vigentes: último otrosí que modifica TIEMPO / VALOR; si no hay, el base. Las filas de la BD sin modifica se infieren.
const vig = desdeDb("k", { hoja: "H", contrato: "C1", orden: 1, filas: [
  { valor: 100, fechaFin: "2026-01-01" },
  { tipo: "OTROSÍ No. 1", objeto: "ADICIONAL DE VALORES", valor: 150, fechaFin: "2099-01-01" },
  { tipo: "OTROSÍ No. 2", objeto: "ADICIONAL DE TIEMPO", valor: 999, fechaFin: "2026-06-01" },
  { tipo: "OTROSÍ No. 3", objeto: "x", modifica: "VALOR", valor: 200, fechaFin: "2000-01-01" },
] });
assert.equal(vig.filas[1].modifica, "VALOR");
assert.equal(vig.valorVigente, 200);
assert.equal(vig.fechaFinVigente, "2026-06-01");
const vig0 = armarContrato("k", "H", "C1", 1, [{ valor: 5, fechaFin: "2026-01-01" }]);
assert.equal(vig0.valorVigente, 5); assert.equal(vig0.fechaFinVigente, "2026-01-01");

// Agrupación canónica: "CO No. 2910829-MO" y "CO No.2910829-MO" son el mismo contrato; la clave es la de la primera fila
const mo = agruparContratos([
  { hoja: "AR", orden: 1, contrato: "CO No. 2910829-MO", objeto: "Obra" },
  { hoja: "AR", orden: 2, contrato: "CO No.2910829-MO", tipo: "OTROSÍ No. 1", objeto: "ADICIONAL DE TIEMPO" },
  { hoja: "AR", orden: 3, contrato: "CO No. 2910829-SM", objeto: "Otro" },
]);
assert.equal(mo.length, 2, "MO separado de SM");
assert.equal(mo[0].filas.length, 2);
assert.equal(mo[0].key, contratoKey("AR", { contrato: "CO No. 2910829-MO" }));

// Alias en la carga: el grupo origen se agrega al destino (existente en el archivo, o tomado de la BD sin repetir filas)
const g = (k, h, c, o, filas) => armarContrato(k, h, c, o, filas);
const arch = [g("AR|A", "AR", "A", 1, [{ contrato: "A", objeto: "a" }]), g("AR|B", "AR", "B", 2, [{ contrato: "B", objeto: "b", tipo: "OTROSÍ No. 1" }]), g("AR|C", "AR", "C", 3, [{ contrato: "C" }])];
const al = aplicarAlias(arch, { "AR|B": "AR|C", "AR|C": "AR|A" });
assert.deepEqual(al.cs.map((c) => c.key), ["AR|A"], "cadena B→C→A");
assert.deepEqual(al.cs[0].filas.map((f) => f.contrato), ["A", "B", "C"], "en orden de archivo");
assert.equal(aplicarAlias(arch, { "AR|B": "AR|C", "AR|C": "AR|B" }).cs.length, 3, "ciclo: se ignora");
const sinDest = aplicarAlias([arch[1]], { "AR|B": "AR|A" }, { "AR|A": { hoja: "AR", contrato: "A", orden: 1, filas: [{ contrato: "A", objeto: "a" }] } });
assert.equal(sinDest.cs.length, 1); assert.equal(sinDest.cs[0].key, "AR|A"); assert.equal(sinDest.cs[0].filas.length, 2);
assert.equal(aplicarAlias([arch[1]], { "AR|B": "AR|X" }).cs.length, 1, "destino inexistente: se queda como está");

// Sugerencias (i): mismo contrato escrito distinto en la misma hoja; -MO/-SM y otras hojas no
const sg = sugerencias([
  g("AR|CO NO- 1-MO", "AR", "CO No. 1-MO", 1, [{ contrato: "CO No. 1-MO" }]),
  g("AR|CO NO-1-MO", "AR", "CO No.1-MO", 2, [{ contrato: "CO No.1-MO", tipo: "OTROSÍ No. 1" }]),
  g("AR|CO NO- 1-SM", "AR", "CO No. 1-SM", 3, [{ contrato: "CO No. 1-SM" }]),
  g("BB|CO NO- 1-MO", "BB", "CO No. 1-MO", 4, [{ contrato: "CO No. 1-MO" }]),
]);
assert.deepEqual(sg.map((s) => [s.key, s.destino]), [["AR|CO NO-1-MO", "AR|CO NO- 1-MO"]]);

// Sugerencias (iv): CONTRATO que es una etiqueta de otrosí; con prefijo va al contrato que lo contiene, sin prefijo al anterior
const sg4 = sugerencias([
  g("H|CPF-5551", "H", "CPF-5551", 1, [{ contrato: "CPF-5551" }]),
  g("H|CO 2", "H", "CO 2", 2, [{ contrato: "CO 2" }]),
  g("H|CPF-5551 OTROSI NO- 1", "H", "CPF-5551 OTROSI NO- 1", 3, [{ contrato: "CPF-5551 OTROSI NO- 1", objeto: "x" }]),
  g("H|OTROSI NO- 2", "H", "OTROSI NO- 2", 4, [{ contrato: "OTROSI NO- 2", objeto: "ADICIONAL DE TIEMPO" }]),
]);
assert.deepEqual(sg4.map((s) => [s.key, s.destino]), [["H|CPF-5551 OTROSI NO- 1", "H|CPF-5551"], ["H|OTROSI NO- 2", "H|CO 2"]]);
assert.equal(etiquetaOtrosi("CPF-5551 Otrosí No. 3"), "OTROSÍ No. 3");
const ue = planMover({ "H|O": { hoja: "H", contrato: "OTROSI NO- 2", orden: 2, filas: [{ contrato: "OTROSI NO- 2", objeto: "x" }] }, "H|T": { hoja: "H", contrato: "CO 2", orden: 1, filas: [{ contrato: "CO 2" }] } }, {}, "H|O", "H|T", null, () => "i");
assert.deepEqual(ue["contratosExcel/contratos/H|T/filas"][1], { contrato: "CO 2", objeto: "x", tipo: "OTROSÍ No. 2" });

// Mover/unir: un solo update, alias, comentarios y filas ordenadas por fecha de inicio
const cdb = { "AR|X": { hoja: "AR", contrato: "X", orden: 1, filas: [{ fechaInicio: "2020-01-01" }, { fechaInicio: "2022-01-01", tipo: "OTROSÍ No. 2" }] },
  "AR|Y": { hoja: "AR", contrato: "Y", orden: 2, filas: [{ fechaInicio: "2021-01-01", tipo: "OTROSÍ No. 1" }] } };
let n = 0;
const up = planMover(cdb, { "AR|Y": { comentarios: { a: { texto: "hola" } }, fechaCompromiso: "2027-01-01" } }, "AR|Y", "AR|X", null, () => "id" + ++n);
assert.deepEqual(up["contratosExcel/contratos/AR|X/filas"].map((f) => f.fechaInicio), ["2020-01-01", "2021-01-01", "2022-01-01"]);
assert.equal(up["contratosExcel/contratos/AR|Y"], null);
assert.equal(up["contratosAlias/AR|Y"], "AR|X");
assert.equal(up["contratosNotas/AR|X/comentarios/id1"].texto, "hola");
assert.equal(up["contratosNotas/AR|Y"], null);
const um = planMover(cdb, {}, "AR|X", "AR|Y", 1, () => "z");
assert.deepEqual(Object.keys(um).sort(), ["contratosExcel/contratos/AR|X/filas", "contratosExcel/contratos/AR|Y/filas"], "una fila: sin alias");
assert.equal(um["contratosExcel/contratos/AR|X/filas"].length, 1);
assert.deepEqual(unirFilas([{ a: 1 }], [{ fechaInicio: "2020-01-01" }]).length, 2, "sin fechas: al final");

// Contratos nuevos desde el portal
const dbc = [{ hoja: "ACME", orden: 5 }, { hoja: "ACME", orden: 9 }, { hoja: "BETA", orden: 10003 }];
assert.equal(siguienteOrden(dbc, "acme"), 10, "al final de su hoja");
assert.equal(siguienteOrden(dbc, "NUEVA"), 20004, "hoja nueva: después de todo");
const fn = filaNueva({ entidad: "E", contrato: "CO 1", valor: 5 }, [{}, { tipo: "OTROSÍ No. 1" }], false);
assert.deepEqual(fn, { tipo: "OTROSÍ No. 2", entidad: "E", contrato: "CO 1", modifica: "TIEMPO Y VALOR" });
assert.equal(filaNueva({}, [], true).tipo, "LIQUIDACIÓN");
const nuevo = { hoja: "NUEVA", orden: 1, filas: [{ contrato: "X.1", tipo: "---" }, fn] };
assert.equal(construirLibro([armarContrato("k", "NUEVA", "X.1", 1, nuevo.filas)]).SheetNames[0], "NUEVA");

console.log("contratosExcel.check OK");
