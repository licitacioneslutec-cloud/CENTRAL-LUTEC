// Cruce Compras WO: facturas del portal (DIAN, `nERP` = documento de World Office) vs el reporte mensual "Compras por Documento".
// Funciones puras (sin React ni Firebase) para poder probarlas en node: cruceWO.check.js
import * as XLSX from "xlsx";
import { txt, nombreH, fecha } from "./carteraExcel.js";
import { TOLERANCIA, nitKey } from "./cxpConciliacion.js";

export { TOLERANCIA };
// [clave, nombre, color (Excel / interfaz)]
export const CATS = [["ok", "OK", "83CBEB"], ["dif", "Con diferencia", "92D050"], ["noWO", "Sin documento en WO", "FFC000"], ["sinERP", "Sin N.º ERP", "FFFF00"], ["soloWO", "Solo WO", "D9D9D9"]];
export const CAT = Object.fromEntries(CATS.map(([k, n, c]) => [k, { n, c }]));
export const REV = { pendiente: "Pendiente", aprobado: "Aprobado", observado: "Observado", cambio: "Cambió" };

const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0);
const pad = (n) => String(n).padStart(2, "0");

// "21029" → "CR 21029"; "FC PN 963" → "FC 963"; "NCPR  334" → "NCP 334"; "CREM123" → "CREM 123"; el resto, en mayúsculas y con espacios simples
export const normDoc = (v) => {
  const s = txt(v).toUpperCase().replace(/\.0+$/, "").replace(/^([A-Z]+)(\d+)$/, "$1 $2");
  return /^\d+$/.test(s) ? "CR " + s : s.replace(/^FC PN (\d+)$/, "FC $1").replace(/^NCPR (\d+)$/, "NCP $1");
};
// "DD-MM-YYYY" (portal), "DD/MM/YYYY", "YYYY-MM-DD" o Date → "YYYY-MM-DD" ("" si no se entiende)
export const fechaISO = (v) => {
  if (v instanceof Date) return fecha(v);
  const s = String(v ?? ""), a = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/), b = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return a ? `${a[3]}-${pad(a[2])}-${pad(a[1])}` : b ? b[0] : "";
};
const fechaWO = (v) => (typeof v === "number" ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : fechaISO(v));
const clave = (s) => String(s).replace(/[.#$/[\]]/g, "_");

// ─── Lectura del reporte (.xlsx / .xlk) ───
const ALIAS = { nit: /^(CC\/NIT|NIT|CC)/, proveedor: /^PROVEEDOR/, doc: /^DOCUMENTO/, valor: /^VALOR TOTAL/, fecha: /^FECHA/, bruta: /^COMPRA BRUTA/, iva: /^IVA/ };

// wb = libro leído con { cellDates: true } → { desde, hasta, mes: "YYYY-MM", docs: [{doc, docOrig, nit, proveedor, fecha, bruta, iva, valor}], total }
export function leerComprasWO(wb) {
  const a = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.includes("ExportarAExcel") ? "ExportarAExcel" : wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  let hi = -1, col = {};
  for (let i = 0; i < Math.min(a.length, 20) && hi < 0; i++) {
    const h = (a[i] || []).map(nombreH), c = Object.fromEntries(Object.entries(ALIAS).map(([k, re]) => [k, h.findIndex((x) => re.test(x))]));
    if (c.doc >= 0 && c.valor >= 0) { hi = i; col = c; }
  }
  if (hi < 0) throw new Error('No es el reporte "Compras por Documento" de World Office (faltan las columnas Documento y Valor Total).');
  const per = a.slice(0, hi).map((r) => txt(r?.[0])).join(" ").match(/(\d{2})\/(\d{2})\/(\d{4})\s+Y\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  const g = (r, k) => (col[k] >= 0 ? r[col[k]] : null), docs = [];
  for (const r of a.slice(hi + 1)) {
    const d = txt(g(r, "doc"));
    if (!r || !d || /^TOTAL/i.test(d) || g(r, "valor") === null || g(r, "valor") === "") continue;
    docs.push({ doc: normDoc(d), docOrig: d, nit: txt(g(r, "nit")), proveedor: txt(g(r, "proveedor")), fecha: fechaWO(g(r, "fecha")), bruta: col.bruta >= 0 ? num(g(r, "bruta")) : null, iva: col.iva >= 0 ? num(g(r, "iva")) : null, valor: num(g(r, "valor")) });
  }
  if (!docs.length) throw new Error("No se encontraron documentos en el archivo.");
  const desde = per ? `${per[3]}-${per[2]}-${per[1]}` : "", hasta = per ? `${per[6]}-${per[5]}-${per[4]}` : "";
  const mes = desde.slice(0, 7) || (docs.find((d) => d.fecha)?.fecha || "").slice(0, 7);
  return { desde, hasta, mes, docs, total: docs.reduce((s, d) => s + d.valor, 0) };
}

// ─── Cruce ───
// facturas = [{id, nERP, nitEmisor, nombreEmisor, total, fechaEmision, tipoDoc, observacion}]; docs = docs de leerComprasWO; pares = { facturaId: docWO | "" }.
// Piscina de facturas: las que tienen pareja (nERP en el reporte o emparejadas a mano) más las que no la tienen y cuya fecha de emisión cae entre el
// mes anterior y el mes del reporte (o no tiene fecha): una factura de octubre se contabiliza en octubre o noviembre, y la de un mes viejo no es de este cruce.
// Categorías: ok (mismo doc, mismo NIT, |valor| ± tolerancia) | dif | noWO (tiene N.º ERP pero ese doc no está en el reporte) | sinERP | soloWO.
// Los valores se comparan en valor absoluto (DMP y notas crédito traen signo distinto).
export function cruzar(facturas, docs, mes, pares = {}) {
  const W = {};
  for (const d of docs) { if (W[d.doc]) W[d.doc].valor += d.valor; else W[d.doc] = { ...d }; } // un mismo doc repetido se suma
  const [y, m] = (mes || "0000-00").split("-").map(Number), lo = m > 1 ? `${y}-${pad(m - 1)}-01` : `${y - 1}-12-01`, hi = `${mes}-31`;
  const F = (facturas || []).map((f) => ({ ...f, doc: normDoc(f.nERP), nit: nitKey(f.nitEmisor), t: Number(f.total) || 0, fe: fechaISO(f.fechaEmision) }));
  const dv = (f, w) => Math.abs(f.t) - Math.abs(w.valor), buena = (f, w) => f.nit === nitKey(w.nit) && Math.abs(dv(f, w)) <= TOLERANCIA;
  const par = {}, usado = new Set(); // id → doc
  const unir = (f, d) => { par[f.id] = d; usado.add(d); };
  for (const f of F) { const d = pares[f.id]; if (d && W[d] && !usado.has(d)) { unir(f, d); f.manual = d !== f.doc; } } // manuales primero
  for (const estricta of [true, false]) { // misma factura+doc: primero la que cuadra, para que un N.º ERP repetido no robe la pareja
    for (const f of F) if (!(f.id in par) && pares[f.id] !== "" && W[f.doc] && !usado.has(f.doc) && (!estricta || buena(f, W[f.doc]))) unir(f, f.doc);
  }
  const filas = [];
  for (const f of F) {
    const base = { key: clave(f.id), id: f.id, num: txt(f.nERP), proveedor: f.nombreEmisor || "", nit: f.nit, fecha: f.fe, obs: f.observacion || "", tipoDoc: f.tipoDoc || "", valorPortal: f.t, valorWO: null, dif: null, doc: null, manual: !!f.manual, sugerencia: "" };
    const w = W[par[f.id]];
    if (w) {
      const d = dv(f, w), nitOk = f.nit === nitKey(w.nit);
      filas.push({ ...base, doc: w.doc, valorWO: w.valor, dif: d, categoria: nitOk && Math.abs(d) <= TOLERANCIA ? "ok" : "dif", sugerencia: !nitOk ? `NIT distinto: el reporte trae ${w.nit} (${w.proveedor})` : Math.abs(d) > TOLERANCIA ? "Valor distinto al del reporte" : "" });
    } else if ((!f.fe || (f.fe >= lo && f.fe <= hi))) {
      filas.push({ ...base, categoria: f.doc ? "noWO" : "sinERP", sugerencia: f.doc && W[f.doc] ? "N.º ERP repetido: ese documento ya está cruzado con otra factura" : "" });
    }
  }
  for (const w of Object.values(W)) if (!usado.has(w.doc)) filas.push({ key: "W_" + clave(w.doc), id: null, num: w.doc, proveedor: w.proveedor, nit: nitKey(w.nit), fecha: w.fecha, obs: "", tipoDoc: "", valorPortal: null, valorWO: w.valor, dif: null, doc: w.doc, manual: false, sugerencia: "", categoria: "soloWO" });
  // Sugerencias: factura sin pareja ↔ doc solo WO del mismo NIT y valor (±tolerancia), uno a uno, la de menor diferencia primero
  const solo = filas.filter((x) => x.categoria === "soloWO"), cand = [];
  for (const x of filas) if (x.categoria === "noWO" || x.categoria === "sinERP") for (const s of solo) if (x.nit === s.nit && Math.abs(Math.abs(x.valorPortal) - Math.abs(s.valorWO)) <= TOLERANCIA) cand.push([Math.abs(Math.abs(x.valorPortal) - Math.abs(s.valorWO)), x, s]);
  const nCand = (k) => cand.filter((c) => c[1] === k).length, hechos = new Set();
  for (const [, x, s] of cand.sort((p, q) => p[0] - q[0])) {
    if (hechos.has(x) || hechos.has(s)) continue;
    hechos.add(x); hechos.add(s);
    const otras = nCand(x) > 1 ? " (hay otras candidatas)" : "";
    x.sugDoc = s.doc; s.sugId = x.id;
    x.sugerencia = (x.categoria === "noWO" ? `Posible N.º ERP mal digitado: el reporte tiene ${s.doc}` : `Posible documento: ${s.doc}`) + otras;
    s.sugerencia = `Posible factura del portal: ${x.num || "sin N.º ERP"} (${x.proveedor})`;
  }
  return filas.sort((p, q) => String(p.num).localeCompare(String(q.num), "es", { numeric: true }) || String(p.categoria).localeCompare(q.categoria));
}

const suma = (l, k) => l.reduce((s, f) => s + (f[k] ?? 0), 0);
export function resumenCruce(filas, docs) {
  const porCat = Object.fromEntries(CATS.map(([k]) => { const l = filas.filter((f) => f.categoria === k); return [k, { n: l.length, valor: suma(l, k === "soloWO" ? "valorWO" : "valorPortal") }]; }));
  return { wo: suma(docs || [], "valor"), nWO: (docs || []).length, portal: suma(filas, "valorPortal"), nPortal: filas.filter((f) => f.id != null).length, nDocs: filas.length, porCat };
}

// ─── Revisión: cruceWO/revision/{mes}/{key} = { par?, estado?, nota?, autor, at, firma } (key = id de la factura o "W_doc") ───
export const firmaDe = (f) => `${f.valorPortal}|${f.valorWO}|${f.doc || ""}`;
// una aprobación/observación cuyos valores o pareja cambiaron desde la revisión ya no vale
export const estadoRev = (f, rec) => (!rec?.estado ? "pendiente" : rec.firma !== firmaDe(f) ? "cambio" : rec.estado);
// revisión del mes → { facturaId: docWO | "" } (solo los que tienen `par`; las claves W_ nunca llevan par)
export function paresDe(rev) {
  const o = {};
  for (const [k, r] of Object.entries(rev || {})) if (typeof r?.par === "string") o[k] = r.par;
  return o;
}

const encab = ["Categoría", "N.º ERP / Doc WO", "Doc WO cruzado", "NIT", "Proveedor", "Fecha", "Observación del portal", "Valor portal", "Valor WO", "Diferencia", "Sugerencia"];
const encabRev = ["Revisión", "Nota", "Revisado por"];
const fila = (f, rv) => [CAT[f.categoria].n, f.num, f.doc && f.doc !== normDoc(f.num) ? f.doc : "", f.nit, f.proveedor, f.fecha, f.obs, f.valorPortal, f.valorWO, f.dif, f.sugerencia, ...(rv ? rv(f) : [])];

// La librería xlsx instalada no escribe colores: una hoja por categoría y una completa con la columna Categoría
// revision(f) → [Revisión, Nota, Revisado por] (opcional)
export function libroCruceWO(X, { mes, filas, resumen, revision }) {
  const wb = X.utils.book_new(), hoja = (n, aoa) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), n);
  hoja("Resumen", [["Mes", mes], [], ["Total reporte WO", resumen.wo], ["Total facturas del portal (cruce)", resumen.portal], [], ["Categoría", "Docs", "Valor"], ...CATS.map(([k, n]) => [n, resumen.porCat[k].n, resumen.porCat[k].valor])]);
  const eh = revision ? [...encab, ...encabRev] : encab;
  hoja("Todas", [eh, ...filas.map((f) => fila(f, revision))]);
  for (const [k, n] of CATS) hoja(n, [eh, ...filas.filter((f) => f.categoria === k).map((f) => fila(f, revision))]);
  return wb;
}
