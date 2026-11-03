// Conciliación de proveedores: cartera de Lutec (World Office, "Proveedor") vs estado de cuenta del proveedor.
// Funciones puras (sin React ni Firebase) para poder probarlas en node: cxpConciliacion.check.js
import * as XLSX from "xlsx";
import { txt, nombreH, fecha } from "./carteraExcel.js";

export const TOLERANCIA = 1000; // igual que valorContabilizado en facturas
// [clave, nombre, color (Excel manual)]
export const CATS = [["ok", "OK", "83CBEB"], ["dif", "Con diferencia", "92D050"], ["apto", "Cruce apto", "FFFF00"], ["soloL", "Solo Lutec", "FFC000"], ["soloP", "Solo proveedor", "D9D9D9"]];
export const CAT = Object.fromEntries(CATS.map(([k, n, c]) => [k, { n, c }]));

// "1352592.71" (punto decimal), "1.352.592,71" (es-CO) o número → número
const num = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
};
const numero = (v) => txt(v).toUpperCase().replace(/\.0+$/, "");
export const nitKey = (nit, nombre = "") => String(nit ?? "").replace(/[.,]/g, "").match(/\d+/)?.[0] || txt(nombre).replace(/[.#$/[\]]/g, "_");

// ─── Estado de cuenta del proveedor (formato libre): encabezado por alias o por mapeo manual ───
export const CAMPOS_PROV = [["num", "N.º de factura *"], ["saldo", "Saldo / valor *"], ["fecha", "Fecha"], ["vence", "Vencimiento"], ["original", "Importe original"], ["dias", "Días vencidos"]];
const ALIAS = {
  num: /^(DOCUMENTO|FACTURA|NUM|NUMERO|NRO|NO\b|N\b|N )/,
  saldo: /^SALDO/,
  valor: /^(VALOR|TOTAL|IMPORTE PENDIENTE)/,
  fecha: /^FECHA( DE)?( DOC\w*| FACT\w*| EMISION)?$/,
  vence: /^(FECHA.*VENC|VENCE|VENCIMIENTO)/,
  original: /ORIGINAL/,
  dias: /^DIAS/,
};

// wb = libro leído con { cellDates: true }; mapeo = { num: "Documento", saldo: "Saldo x Vencer", ... } (nombres de encabezado)
// → { facturas: { num: {num, fecha, vence, dias, original, saldo} }, total, mapeo }. Si no reconoce las columnas lanza Error con .cabeceras.
export function leerEstadoProveedor(wb, mapeo) {
  const a = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const fila = (r, f) => r.map((c) => nombreH(c)).map((c, i) => (c && f(c) ? i : -1)).find((i) => i >= 0) ?? -1;
  let hi = -1, col = {};
  for (const mp of mapeo?.num && mapeo?.saldo ? [mapeo, null] : [null]) { // el mapeo guardado primero; si el formato cambió, por alias
    for (let i = 0; i < Math.min(a.length, 20) && hi < 0; i++) {
      const r = a[i]; if (!r) continue;
      const c = {};
      if (mp) {
        for (const [k] of CAMPOS_PROV) if (mp[k]) c[k] = fila(r, (h) => h === nombreH(mp[k]));
      } else {
        c.num = fila(r, (h) => ALIAS.num.test(h));
        c.saldo = fila(r, (h) => ALIAS.saldo.test(h));
        if (c.saldo < 0) c.saldo = fila(r, (h) => ALIAS.valor.test(h));
        for (const k of ["fecha", "vence", "original", "dias"]) c[k] = fila(r, (h) => ALIAS[k].test(h));
      }
      if (c.num >= 0 && c.saldo >= 0 && c.num !== c.saldo) { hi = i; col = c; }
    }
    if (hi >= 0) break;
  }
  if (hi < 0) {
    // sin encabezado: lista de dos columnas (número, valor)
    const d = a.filter((r) => r && r.length >= 2 && /^\d+$/.test(numero(r[0])) && r[1] !== null && !isNaN(num(r[1])));
    if (d.length >= 3 && d.length >= a.filter((r) => r && r.some((c) => c !== null)).length * 0.8) return armar(a, 0, { num: 0, saldo: 1 }, {});
    const cand = a.slice(0, 20).map((r) => (r || []).map((c) => txt(c))).sort((x, y) => y.filter(Boolean).length - x.filter(Boolean).length)[0] || [];
    throw Object.assign(new Error("No se reconocieron las columnas del archivo: elija cuáles son."), { cabeceras: [...new Set(cand.filter(Boolean))] });
  }
  const nombres = Object.fromEntries(Object.entries(col).filter(([, i]) => i >= 0).map(([k, i]) => [k, txt(a[hi][i])]));
  return armar(a, hi + 1, col, nombres);
}

function armar(a, desde, col, mapeo) {
  const facturas = {};
  for (const r of a.slice(desde)) {
    if (!r) continue;
    const n = numero(r[col.num]);
    if (!n || /^TOTAL/.test(n) || r[col.saldo] === null || r[col.saldo] === undefined || r[col.saldo] === "") continue;
    const g = (k) => (col[k] >= 0 && col[k] !== undefined ? r[col[k]] : null);
    const saldo = num(r[col.saldo]);
    if (facturas[n]) { facturas[n].saldo += saldo; if (g("original") !== null) facturas[n].original = (facturas[n].original ?? 0) + num(g("original")); continue; }
    facturas[n] = { num: n, fecha: fecha(g("fecha")), vence: fecha(g("vence")), dias: g("dias") === null ? null : num(g("dias")), original: g("original") === null ? null : num(g("original")), saldo };
  }
  const total = Object.values(facturas).reduce((s, f) => s + f.saldo, 0);
  if (!Object.keys(facturas).length) throw new Error("No se encontraron facturas en el archivo.");
  return { facturas, total, mapeo };
}

// facturas de leerCartera (o ya agrupadas) → una fila por número (los repetidos se suman)
export function agruparLutec(facturas) {
  const g = {};
  for (const f of Object.values(facturas || {})) {
    const n = numero(f.num), x = g[n];
    if (x) { x.valor += f.valor; x.n += f.n || 1; } else g[n] = { num: n, valor: f.valor, n: f.n || 1, fecha: f.fecha, vence: f.vence, dias: f.dias };
  }
  return g;
}
// lista guardada en RTDB (array) → { num: factura }
export const aMapa = (l) => Object.fromEntries(Object.values(l || {}).map((f) => [f.num, f]));

// ─── Revisión: cxp/revision/{nit}/{claveFila} = { par?, estado?, nota?, autor, at, firma } ───
export const REV = { pendiente: "Pendiente", aprobado: "Aprobado", observado: "Observado", cambio: "Cambió" };
export const claveFila = (f) => (f.categoria === "soloP" ? "P_" : "") + String(f.num).replace(/[.#$/[\]]/g, "_");
export const firmaDe = (f) => `${f.valorLutec}|${f.saldoProv}|${f.numProv || ""}`;
// una aprobación/observación cuyo valor, saldo o pareja cambiaron desde la revisión ya no vale
export const estadoRev = (f, rec) => (!rec?.estado ? "pendiente" : rec.firma !== firmaDe(f) ? "cambio" : rec.estado);
// revisión de un proveedor → { numLutec: numProv | "" } (solo los que tienen `par`)
export function paresDe(rev, lutec) {
  const o = {};
  for (const n of Object.keys(agruparLutec(lutec))) { const r = rev?.[claveFila({ num: n })]; if (typeof r?.par === "string") o[n] = r.par; }
  return o;
}

// lutec = facturas de leerCartera; proveedor/apto = facturas de leerEstadoProveedor (apto opcional).
// pares = { numLutec: numProveedor } (emparejar a mano aunque el número difiera) o { numLutec: "" } (separar: no emparejar con el mismo número).
// Prioridad: número en apto → "apto"; en Lutec y proveedor → ok/dif; solo Lutec; solo proveedor (también los apto que Lutec no tiene).
export function conciliar({ lutec, proveedor = {}, apto = {} }, pares = {}) {
  const L = agruparLutec(lutec), filas = [], usado = new Set(), par = {};
  const hay = (m) => proveedor[m] || apto[m];
  for (const n of Object.keys(L)) if (pares[n] && hay(pares[n]) && !usado.has(pares[n])) { par[n] = pares[n]; usado.add(pares[n]); } // manuales primero
  for (const n of Object.keys(L)) if (!(n in par) && pares[n] !== "" && hay(n) && !usado.has(n)) { par[n] = n; usado.add(n); }
  const base = (num, o) => ({ num, valorLutec: null, saldoProv: null, dif: null, enProv: 0, fecha: o.fecha || null, vence: o.vence || null, dias: o.dias ?? null, repetidoLutec: false, sugerencia: "" });
  for (const [n, l] of Object.entries(L)) {
    const m = par[n], p = m && proveedor[m], a = m && apto[m], s = a || p;
    const f = { ...base(n, l), valorLutec: l.valor, repetidoLutec: l.n > 1, enProv: p?.saldo ?? 0 };
    if (m && m !== n) { f.numProv = m; f.manual = true; }
    if (s) { f.saldoProv = s.saldo; f.dif = l.valor - s.saldo; }
    f.categoria = a ? "apto" : p ? (Math.abs(f.dif) <= TOLERANCIA ? "ok" : "dif") : "soloL";
    if (p && !f.dias && p.dias != null) f.dias = p.dias;
    filas.push(f);
  }
  for (const [n, p] of Object.entries({ ...apto, ...proveedor })) {
    if (usado.has(n)) continue;
    filas.push({ ...base(n, p), categoria: "soloP", saldoProv: p.saldo, enProv: proveedor[n]?.saldo ?? 0 });
  }
  sugerencias(filas, proveedor);
  return filas.sort((x, y) => String(x.num).localeCompare(String(y.num), "es", { numeric: true }) || (x.categoria === "soloP") - (y.categoria === "soloP"));
}

function sugerencias(filas, proveedor) {
  const usadas = new Set(), soloP = filas.filter((f) => f.categoria === "soloP");
  for (const f of filas) {
    if (f.categoria !== "dif" && f.categoria !== "apto" && f.categoria !== "soloL") continue;
    const monto = f.categoria === "soloL" ? f.valorLutec : f.dif;
    if (Math.abs(monto) <= TOLERANCIA) continue;
    const o = proveedor[f.numProv || f.num];
    if (o && o.original != null && Math.abs(f.dif - (o.original - o.saldo)) <= TOLERANCIA) { f.sugerencia = "Posible abono del proveedor (importe original − saldo)"; continue; }
    const par = soloP.filter((s) => s.num !== f.num && !usadas.has(s.num) && Math.abs(monto - s.saldoProv) <= TOLERANCIA).sort((x, y) => Math.abs(monto - x.saldoProv) - Math.abs(monto - y.saldoProv))[0]; // s.num !== f.num: no sugerir lo que el usuario separó
    if (par) { usadas.add(par.num); f.sugerencia = `Posible número mal digitado: el proveedor tiene ${par.num}`; par.sugerencia = `Posible número mal digitado en Lutec: ${f.num}`; f.sugPar = par.sugPar = { l: f.num, p: par.num }; continue; }
    if (f.categoria === "apto") f.sugerencia = "Cruce apto con diferencia mayor a la tolerancia";
  }
}

const suma = (l, k) => l.reduce((s, f) => s + (f[k] ?? 0), 0);

// Saldo proveedor + diferencias + cruce apto + solo Lutec − solo proveedor = saldo Lutec (cada fila aporta valorLutec − enProv)
export function puente(filas) {
  const aporte = (l) => suma(l, "valorLutec") - suma(l, "enProv");
  const por = (k) => filas.filter((f) => f.categoria === k);
  const r = {
    saldoProv: suma(filas, "enProv"), diferencias: aporte([...por("ok"), ...por("dif")]), apto: aporte(por("apto")),
    soloLutec: aporte(por("soloL")), soloProv: aporte(por("soloP")), saldoLutec: suma(filas, "valorLutec"),
  };
  r.cuadra = Math.abs(r.saldoProv + r.diferencias + r.apto + r.soloLutec + r.soloProv - r.saldoLutec) < 0.01;
  return r;
}

export function resumenConc(filas) {
  const porCat = Object.fromEntries(CATS.map(([k]) => {
    const l = filas.filter((f) => f.categoria === k);
    return [k, { n: l.length, valor: k === "soloP" ? suma(l, "saldoProv") : suma(l, "valorLutec") }];
  }));
  const lutec = suma(filas, "valorLutec"), prov = suma(filas, "enProv");
  return { lutec, prov, dif: lutec - prov, nDocs: filas.length, porCat };
}

// Facturas que entraron, salieron (se resolvieron) o cambiaron de categoría entre dos conciliaciones
export function compararConciliaciones(ant, act) {
  const A = Object.fromEntries((ant || []).map((f) => [claveFila(f), f])), B = Object.fromEntries((act || []).map((f) => [claveFila(f), f]));
  const out = [];
  for (const [n, f] of Object.entries(B)) {
    if (!A[n]) out.push({ ...f, cambio: "Entró", de: "" });
    else if (A[n].categoria !== f.categoria) out.push({ ...f, cambio: "Cambió de categoría", de: CAT[A[n].categoria]?.n || A[n].categoria });
  }
  for (const [n, f] of Object.entries(A)) if (!B[n]) out.push({ ...f, cambio: "Se resolvió", de: CAT[f.categoria]?.n || f.categoria });
  return out;
}

const encab = ["Categoría", "Factura", "Fecha", "Vence", "Días", "Valor Lutec", "Saldo proveedor", "Diferencia", "Repetido en Lutec", "Sugerencia"];
const encabRev = ["Revisión", "Nota", "Revisado por", "Emparejado con"];
const fila = (f, rv) => [CAT[f.categoria]?.n || f.categoria, f.num, f.fecha, f.vence, f.dias, f.valorLutec, f.saldoProv, f.dif, f.repetidoLutec ? "Sí" : "", f.sugerencia, ...(rv ? rv(f) : [])];

// La librería xlsx instalada no escribe colores: una hoja por categoría y una completa con la columna Categoría
// revision(f) → [Revisión, Nota, Revisado por, Emparejado con] (opcional)
export function libroConciliacionCxp(X, { nombre, fecha: fc, filas, resumen, revision }) {
  const wb = X.utils.book_new();
  const hoja = (n, aoa) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), n);
  const p = puente(filas);
  hoja("Resumen", [
    ["Proveedor", nombre], ["Fecha", fc], [],
    ["Saldo Lutec", resumen.lutec], ["Saldo proveedor", resumen.prov], ["Diferencia", resumen.dif], [],
    ["Puente", "Valor"], ["Saldo proveedor", p.saldoProv], ["+ Diferencias", p.diferencias], ["+ Cruce apto", p.apto], ["+ Solo Lutec", p.soloLutec], ["− Solo proveedor", p.soloProv], ["= Saldo Lutec", p.saldoLutec], [],
    ["Categoría", "Docs", "Valor"], ...CATS.map(([k, n]) => [n, resumen.porCat[k]?.n ?? 0, resumen.porCat[k]?.valor ?? 0]),
  ]);
  const eh = revision ? [...encab, ...encabRev] : encab;
  hoja("Todas", [eh, ...filas.map((f) => fila(f, revision))]);
  for (const [k, n] of CATS) hoja(n, [eh, ...filas.filter((f) => f.categoria === k).map((f) => fila(f, revision))]);
  return wb;
}
