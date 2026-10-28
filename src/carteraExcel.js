// Cartera: lee el "Estado de Cuenta 30-60-90" de World Office y compara cortes diarios.
// Funciones puras (sin React ni Firebase) para poder probarlas en node: carteraExcel.check.js
import * as XLSX from "xlsx";

export const RANGOS = ["Por vencer", "1-30", "31-60", "61-90", "91-180", "181-360", "+360"];
export const rango = (d) => (d <= 0 ? RANGOS[0] : d <= 30 ? RANGOS[1] : d <= 60 ? RANGOS[2] : d <= 90 ? RANGOS[3] : d <= 180 ? RANGOS[4] : d <= 360 ? RANGOS[5] : RANGOS[6]);

const txt = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const nombreH = (v) => txt(v).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s) => s.replace(/[.#$/[\]]/g, "_");
const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0);
const pad = (n) => String(n).padStart(2, "0");
// Date (cellDates; la hora viene desplazada, se usa UTC) o "DD/MM/YYYY" → "YYYY-MM-DD"
const fecha = (v) => {
  if (v instanceof Date && !isNaN(v)) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : "";
};

// wb = libro leído con { cellDates: true }
export function leerCartera(wb) {
  const ws = wb.Sheets[wb.SheetNames.includes("ExportarAExcel") ? "ExportarAExcel" : wb.SheetNames[0]];
  const a = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const titulo = a.slice(0, 3).map((r) => txt(r?.[0])).find((t) => /30-60-90/.test(t));
  const m = titulo?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const hi = a.slice(0, 20).findIndex((r) => r && r.some((c) => nombreH(c) === "NOMBRES_ETIQUETA") && r.some((c) => nombreH(c) === "DOC"));
  if (!titulo || !m || hi < 0) throw new Error("El archivo no parece un Estado de Cuenta 30-60-90 de World Office.");
  const col = {};
  a[hi].forEach((c, i) => { col[nombreH(c)] = i; });
  for (const h of ["NOMBRES", "IDENTIFICACION", "DOC", "NUM", "VALOR TOTAL", "NUMDIAS"]) if (col[h] === undefined) throw new Error(`Falta la columna "${h}" en el archivo.`);
  const g = (r, h) => r[col[h]];
  const facturas = {};
  let totalGeneral = null, cli = "", nit = "", suc = "", dir = "", ven = "";
  for (const r of a.slice(hi + 1)) {
    if (!r) continue;
    if (txt(g(r, "NOMBRES_ETIQUETA")) === "Cliente") { cli = txt(g(r, "NOMBRES")); nit = txt(g(r, "IDENTIFICACION")); suc = dir = ven = ""; }
    const doc = txt(g(r, "DOC"));
    if (!doc) { if (r.some((c) => /^Total general/i.test(txt(c)))) totalGeneral = num(g(r, "VALOR TOTAL")); continue; }
    suc = txt(g(r, "SUCURSAL")) || suc; dir = txt(g(r, "DIRECCION")) || dir; ven = txt(g(r, "VENDEDOR")) || ven;
    const base = clave(`${nit}|${dir}|${doc}|${txt(g(r, "NUM"))}`);
    let k = base, n = 1;
    while (facturas[k]) k = clave(`${base}#${++n}`);
    facturas[k] = { cli, nit, suc, ven, doc, num: txt(g(r, "NUM")), fecha: fecha(g(r, "FECHA")), vence: fecha(g(r, "FECHA VENCE")), valor: num(g(r, "VALOR TOTAL")), dias: num(g(r, "NUMDIAS")) };
  }
  const total = Object.values(facturas).reduce((s, f) => s + f.valor, 0);
  return { fechaCorte: `${m[3]}-${m[2]}-${m[1]}`, facturas, total, totalGeneral };
}

const suma = (l) => l.reduce((s, f) => s + f.valor, 0);

export function resumenCorte(facturas) {
  const l = Object.values(facturas);
  const porRango = Object.fromEntries(RANGOS.map((r) => [r, 0]));
  const porCli = {};
  for (const f of l) { porRango[rango(f.dias)] += f.valor; porCli[f.cli] = (porCli[f.cli] || 0) + f.valor; }
  const topClientes = Object.entries(porCli).map(([cli, valor]) => ({ cli, valor })).sort((x, y) => y.valor - x.valor).slice(0, 10);
  return { total: suma(l), vencido: suma(l.filter((f) => f.dias > 0)), nDocs: l.length, porRango, topClientes };
}

export function compararCortes(ant, act) {
  const saldoAct = suma(Object.values(act));
  if (!ant) return { nuevas: [], salieron: [], cambioValor: [], cambioRango: [], cascada: { saldoAnt: saldoAct, nuevas: 0, salieron: 0, ajustes: 0, saldoAct } };
  const nuevas = [], salieron = [], cambioValor = [], cambioRango = [];
  for (const [k, f] of Object.entries(act)) {
    const o = ant[k];
    if (!o) { nuevas.push({ ...f, k }); continue; }
    if (Math.abs(f.valor - o.valor) > 0.005) cambioValor.push({ ...f, k, antes: o.valor, despues: f.valor, delta: f.valor - o.valor });
    if (rango(f.dias) !== rango(o.dias)) cambioRango.push({ ...f, k, de: rango(o.dias), a: rango(f.dias) });
  }
  for (const [k, f] of Object.entries(ant)) if (!act[k]) salieron.push({ ...f, k });
  const saldoAnt = suma(Object.values(ant));
  const ajustes = cambioValor.reduce((s, f) => s + f.delta, 0);
  return { nuevas, salieron, cambioValor, cambioRango, cascada: { saldoAnt, nuevas: suma(nuevas), salieron: suma(salieron), ajustes, saldoAct } };
}

export function libroComparacion(X, { fecha: fAct, fechaAnt, resumen, comp, todas, filtro }) {
  const wb = X.utils.book_new();
  const hoja = (n, aoa) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), n);
  const base = (f) => [f.cli, f.nit, f.suc, f.doc, f.num, f.fecha, f.vence, f.dias];
  const H = ["Cliente", "NIT", "Sucursal", "Doc", "Num", "Fecha", "Vence", "Días"];
  const c = comp.cascada;
  hoja("Resumen", [
    ["Corte", fAct], ["Corte anterior", fechaAnt || "—"], [],
    ["Saldo total", resumen.total], ["Vencido", resumen.vencido], ["N.º documentos", resumen.nDocs], [],
    ["Saldo anterior", c.saldoAnt], ["+ Nuevas", c.nuevas], ["− Salieron", c.salieron], ["± Ajustes de valor", c.ajustes], ["Saldo actual", c.saldoAct], [],
    ["Rango", "Valor"], ...RANGOS.map((r) => [r, resumen.porRango[r] || 0]), [],
    ["Top clientes", "Saldo"], ...resumen.topClientes.map((t) => [t.cli, t.valor]),
  ]);
  hoja("Nuevas", [[...H, "Valor"], ...comp.nuevas.map((f) => [...base(f), f.valor])]);
  hoja("Salieron", [[...H, "Valor"], ...comp.salieron.map((f) => [...base(f), f.valor])]);
  hoja("Cambios de valor", [[...H, "Antes", "Después", "Diferencia"], ...comp.cambioValor.map((f) => [...base(f), f.antes, f.despues, f.delta])]);
  hoja("Cambios de rango", [[...H, "Valor", "De", "A"], ...comp.cambioRango.map((f) => [...base(f), f.valor, f.de, f.a])]);
  const HV = [...H, "Vendedor", "Valor"], fv = (f) => [...base(f), f.ven, f.valor];
  if (todas) hoja("Todas", [HV, ...todas.map(fv)]);
  if (filtro) hoja("Filtro", [HV, ...filtro.map(fv)]); // lo filtrado de la pestaña activa
  return wb;
}

// ─── Cruce con banco: notas crédito del extracto vs facturas de cartera ───
// nombre normalizado: sin tildes/puntuación ni sufijos societarios (S.A.S, SAS, S.A., LTDA)
const normN = (s) => nombreH(s).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").replace(/\b(S A S|SAS|S A|SA|LTDA|CIA)\b/g, " ").replace(/\s+/g, " ").trim();
export const aliasKey = (t) => clave(normN(t));
const nitBase = (s) => String(s ?? "").replace(/[.,]/g, "").match(/\d+/)?.[0] || "";
// "DD/MM/YYYY", Date o serial de Excel (46317) → "YYYY-MM-DD"
const fechaB = (v) => (typeof v === "number" || /^\d{5}$/.test(String(v)) ? fecha(new Date(Math.round((Number(v) - 25569) * 864e5))) : fecha(v));

// wb = libro leído con { cellDates: true }; devuelve { id: {fecha, desc, valor, rc, fin, tercero, nitDesc} } solo de "Nota Crédito"
export function leerBanco(wb) {
  const ws = wb.Sheets[wb.SheetNames.includes("Movimientos1") ? "Movimientos1" : wb.SheetNames[0]];
  const a = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const hi = a.slice(0, 20).findIndex((r) => r && r.some((c) => nombreH(c) === "TRANSACCION") && r.some((c) => nombreH(c) === "VALOR TOTAL"));
  if (hi < 0) throw new Error("El archivo no parece un extracto bancario (faltan las columnas Transacción y Valor Total).");
  const col = {};
  a[hi].forEach((c, i) => { col[nombreH(c)] = i; });
  if (col["FECHA DE SISTEMA"] === undefined) throw new Error('Falta la columna "Fecha de Sistema" en el archivo.');
  const g = (r, h) => r[col[h]];
  const movs = {};
  for (const r of a.slice(hi + 1)) {
    if (!r || nombreH(g(r, "TRANSACCION")) !== "NOTA CREDITO") continue;
    const f = fechaB(g(r, "FECHA DE SISTEMA")), desc = txt(g(r, "DESCRIPCION MOTIVO")), valor = num(g(r, "VALOR TOTAL"));
    if (!f || !valor) continue;
    const rc = txt(g(r, "RC"));
    const base = clave(`${f}|${valor}|${rc}|${desc}`.slice(0, 200));
    let k = base, n = 1;
    while (movs[k]) k = clave(`${base}#${++n}`);
    movs[k] = { fecha: f, desc, valor, rc, fin: txt(g(r, "FIN DE LA TRANSACCION")).toUpperCase(), tercero: txt(g(r, "TERCERO")), nitDesc: desc.match(/\b\d{9,10}\b/)?.[0] || "" };
  }
  return movs;
}

// clientes = [{nit, cli}]; alias = { aliasKey: nit }. Orden: alias > nombre (Tercero) > NIT de la descripción (suele ser el pagador fiduciario).
export function clienteDe(m, clientes, alias = {}) {
  const ak = aliasKey(m.tercero), t = normN(m.tercero);
  if (ak && alias[ak]) return { nit: alias[ak], por: "alias" };
  if (t) {
    const eq = clientes.find((c) => normN(c.cli) === t);
    if (eq) return { nit: eq.nit, por: "nombre" };
    const co = clientes.filter((c) => { const n = normN(c.cli); return n.length >= 5 && t.length >= 5 && (n.includes(t) || t.includes(n)); });
    if (co.length === 1) return { nit: co[0].nit, por: "nombre" };
  }
  const d = m.nitDesc;
  const c = d && clientes.find((c) => { const b = nitBase(c.nit); return b && (d === b || (d.length === b.length + 1 && d.startsWith(b))); }); // 10 dígitos = NIT + dígito de verificación
  return c ? { nit: c.nit, por: "nit" } : null;
}

// exacto (≤ $1.000) | retención (pago = 88–100,1 % de la suma) | abono (suma > pago) | otro
export function tipoDe(suma, valor) {
  const r = suma ? valor / suma : 0;
  return Math.abs(suma - valor) <= 1000 ? "exacto" : r >= 0.88 && r <= 1.001 ? "retención" : suma > valor ? "abono" : "otro";
}

// facs = facturas del cliente [{k, doc, valor, fecha, dias}]; salieron = Set de claves que salieron en el corte siguiente.
// Subconjuntos de FV/NC (máx 6) cuya suma explique el pago; si no hay, "abono parcial" contra una factura mayor.
export function sugerir(valor, facs, salieron = new Set()) {
  const docs = facs.filter((f) => /^(FV|NC)$/i.test(f.doc) && f.valor).sort((a, b) => (b.valor > 0) - (a.valor > 0) || (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const n = docs.length, negSuf = Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) negSuf[i] = negSuf[i + 1] + Math.min(docs[i].valor, 0);
  const lo = valor / 1.001, hi = valor / 0.88, out = [], pick = [];
  let nodos = 0;
  // ponytail: DFS acotada (20 000 nodos, orden por antigüedad); con cientos de facturas por cliente puede no ver todas las combinaciones
  const dfs = (i, s) => {
    for (let j = i; j < n && nodos < 20000; j++) {
      nodos++;
      const s2 = s + docs[j].valor;
      pick.push(j);
      if (s2 >= lo && s2 <= hi) out.push({ idx: [...pick], suma: s2 });
      if (pick.length < 6 && s2 + negSuf[j + 1] <= hi) dfs(j + 1, s2);
      pick.pop();
    }
  };
  dfs(0, 0);
  const res = out.map(({ idx, suma: s }) => {
    const l = idx.map((j) => docs[j]), dif = s - valor, pct = (dif / s) * 100, tipo = tipoDe(s, valor);
    const edad = Math.min(Math.max(l.reduce((t, f) => t + f.dias, 0) / l.length, 0), 360) / 10;
    const score = (tipo === "exacto" ? 1000 : 0) + (l.every((f) => salieron.has(f.k)) ? 300 : 0) - 40 * l.length - pct * 5 + edad;
    return { claves: l.map((f) => f.k), suma: s, diferencia: dif, pctRetencion: pct, tipo, score };
  }).sort((x, y) => y.score - x.score).slice(0, 5);
  if (res.length) return res;
  return docs.filter((f) => f.valor > valor).sort((x, y) => x.valor - y.valor).slice(0, 3)
    .map((f) => ({ claves: [f.k], suma: f.valor, diferencia: f.valor - valor, pctRetencion: ((f.valor - valor) / f.valor) * 100, tipo: "abono", score: 0 }));
}

// movs = [{id, fecha, desc, valor, rc, fin, tercero, c: conciliación|undefined}]
export function libroConciliacion(X, movs) {
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([
    ["Fecha", "RC", "Fin", "Tercero", "Descripción", "Valor", "Estado", "Cliente", "Facturas", "Suma facturas", "Diferencia", "Tipo", "Autor", "Fecha gestión"],
    ...movs.map((m) => [m.fecha, m.rc, m.fin, m.tercero, m.desc, m.valor, m.c?.estado || "pendiente", m.c?.clienteNombre || "", m.c?.det || "", m.c?.suma ?? "", m.c?.diferencia ?? "", m.c?.tipo || "", m.c?.autor || "", m.c?.at || ""]),
  ]), "Conciliación");
  return wb;
}
