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

export function libroComparacion(X, { fecha: fAct, fechaAnt, resumen, comp }) {
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
  return wb;
}
