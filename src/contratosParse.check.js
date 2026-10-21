// Run: node src/contratosParse.check.js
import assert from "node:assert/strict";
import { extraerContrato as x, parseGrupo as g } from "./contratosParse.js";

const c = (n) => x(n).contrato;
assert.equal(c("CO No. 650153-SM"), "CO No. 650153-SM");
assert.equal(c("CO No, 6630039-SM / 25 - LA PLAZOLETA LA GRATITUD I MZ 7 (432 APTOS)"), "CO No. 6630039-SM");
assert.equal(x("CO No, 6630039-SM / 25 - LA PLAZOLETA LA GRATITUD I MZ 7 (432 APTOS)").objeto, "25 - LA PLAZOLETA LA GRATITUD I MZ 7 (432 APTOS)");
assert.equal(c("CO No. CO-121339"), "CO No. CO-121339");
assert.equal(c("CO No. CO-103165 ET.1"), "CO No. CO-103165");
assert.equal(c("CANELO ET 1 / CO -101356 / AMARILO"), "CO No. CO-101356");
assert.equal(x("CANELO ET 1 / CO -101356 / AMARILO").objeto, "CANELO ET 1 / AMARILO");
assert.equal(c("TORRES 1-2-3-4-5-6-7-8-9 CTO 5740011"), "CTO No. 5740011");
assert.equal(c("MADERO (ETAPA 1) CO No. 1200141"), "CO No. 1200141");
assert.equal(c("OT No. 3120429"), "OT No. 3120429");
assert.equal(c("CO No. C-T91-15 2470928 / SUMINISTRO"), "CO No. C-T91-15 2470928");
assert.equal(c("Seguridad y Control 1210089"), "1210089");
assert.equal(x("Seguridad y Control 1210089").objeto, "Seguridad y Control");
assert.equal(c("640021 - DETECCION INSTALACION"), "640021");
assert.equal(c("TORRE 1 - 1007 - SUMINISTRO"), "1007");
assert.equal(c("Suministro Zonas Comunes 4480020-MO"), "4480020-MO");
assert.equal(c("OM / VB-02"), "");
assert.equal(x("CO No. 650153-SM").objeto, "CO No. 650153-SM");

assert.deepEqual(g("ALEGRIA I - CUSEZAR - BOGOTA - MARTIN AVILA - JORGE REMOLINA"),
  { constructora: "CUSEZAR", proyecto: "ALEGRIA I", localizacion: "BOGOTA", encargado: "MARTIN AVILA - JORGE REMOLINA" });
assert.deepEqual(g("ALEGRIA II- CUSEZAR - MARTIN AVILA - JORGE REMOLINA"),
  { constructora: "CUSEZAR", proyecto: "ALEGRIA II", localizacion: "", encargado: "MARTIN AVILA - JORGE REMOLINA" });
assert.deepEqual(g("LA MARLENE / CUSEZAR"), { constructora: "CUSEZAR", proyecto: "LA MARLENE", localizacion: "", encargado: "" });
assert.equal(g("HITOS - TORRE 86-11").constructora, "HITOS URBANOS");
assert.equal(g("HITOS - TORRE 86-11").proyecto, "TORRE 86-11");
assert.equal(g("EIX 91-15 - HITOS URBANOS - BOGOTA - WILLIAM GARCIA").encargado, "WILLIAM GARCIA");
assert.equal(g("TREZE PPTO C / TREZE CONSTRUCCIONES S.A.S - INGEURBE").constructora, "TREZE CONSTRUCCIONES");
assert.equal(g("TREZE PPTO C / TREZE CONSTRUCCIONES S.A.S - INGEURBE").encargado, "");
assert.equal(g("LA GRATITUD I").constructora, "CUSEZAR");
assert.equal(g("VIALE").constructora, "SIN CONSTRUCTORA");
assert.deepEqual(g("NOMAD - ARPRO"), { constructora: "ARPRO", proyecto: "NOMAD", localizacion: "", encargado: "" });
assert.equal(g("MORPH GRANADA S.A.S - CALI").constructora, "MORPH GRANADA");
assert.equal(g("MORPH GRANADA S.A.S - CALI").localizacion, "CALI");
console.log("contratosParse OK");
