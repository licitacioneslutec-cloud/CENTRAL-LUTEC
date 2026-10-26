// Contratos: lee/escribe el "Cuadro de Experiencia" (una hoja por constructora, 24 columnas).
// Funciones puras (sin React ni Firebase) para poder probarlas en node: contratosExcel.check.js
import * as XLSX from "xlsx";

// Única definición de columnas (carga, formulario y export). tipo: text|number|date|calc.
// calc = T/U/V: no se guardan, se calculan (en el export salen como fórmulas).
export const CAMPOS = [
  { key: "encargado", h: "ENCARGADO", tipo: "text", w: 25 },
  { key: "entidad", h: "ENTIDAD CONTRATANTE O PROPIETARIO DE LA OBRA", tipo: "text", w: 43 },
  { key: "nit", h: "NIT", tipo: "text", w: 16 },
  { key: "proyecto", h: "NOMBRE DEL PROYECTO", tipo: "text", w: 35 },
  { key: "direccion", h: "DIRECCIÓN DEL PROYECTO", tipo: "text", w: 27 },
  { key: "localizacion", h: "LOCALIZACIÓN", tipo: "text", w: 18 },
  { key: "objeto", h: "OBJETO", tipo: "text", w: 70 },
  { key: "contrato", h: "CONTRATO", tipo: "text", w: 22 },
  { key: "tipo", h: "TIPO", tipo: "text", w: 16 },
  { key: "valor", h: "VALOR DEL CONTRATO EJECUTADO A LA TERMINACIÓN ($)", tipo: "number", w: 32 },
  { key: "anticipo", h: "VALOR DEL ANTICIPO", tipo: "number", w: 19 },
  { key: "rete", h: "RETE-GARANTIA", tipo: "number", w: 19 },
  { key: "fechaInicio", h: "FECHA DE INICIACIÓN mm/aaaa", tipo: "date", w: 26 },
  { key: "fechaFin", h: "FECHA DE TERMINACIÓN mm/aaaa", tipo: "date", w: 26 },
  { key: "dias", h: "TIEMPO DE EJECUCIÓN EN DÍAS", tipo: "calc", w: 15 },
  { key: "meses", h: "TIEMPO DE EJECUCIÓN EN MESES", tipo: "calc", w: 15 },
  { key: "diasEj", h: "DÍAS DE EJECUCIÓN", tipo: "calc", w: 15 },
  { key: "estado", h: "ESTADO DE LA OBRA", tipo: "text", w: 18 },
  { key: "observaciones", h: "OBSERVACIONES", tipo: "text", w: 28 },
  { key: "contactoNombre", h: "NOMBRE DE CONTACTO", tipo: "text", w: 28 },
  { key: "contactoNumero", h: "NÚMERO DE CONTACTO", tipo: "text", w: 20 },
  { key: "contactoCorreo", h: "CORREO DE CONTACTO", tipo: "text", w: 25 },
  { key: "firmas", h: "FIRMAS", tipo: "text", w: 20 },
];
// Columnas fuera de CAMPOS: MODIFICA (última del export) y HOJA (primera, solo en el export de una sola hoja).
const MOD = { key: "modifica", h: "MODIFICA", tipo: "text", w: 16 };
const HOJA = { key: "_hoja", h: "HOJA", tipo: "text", w: 22 };
export const ESTADOS = ["EN EJECUCIÓN", "RENOVADO", "EN LIQUIDACIÓN", "FINALIZADO"];
export const MODIFICA = ["TIEMPO", "VALOR", "TIEMPO Y VALOR"];

const sinTilde = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const norm = (s) => sinTilde(s).toUpperCase().replace(/\s+/g, " ").trim();
// Encabezado normalizado: sin tildes, mayúsculas, sin "mm/aaaa", guiones como espacio.
const nh = (s) => norm(s).replace(/MM\/AAAA/g, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
const POR_ENCABEZADO = new Map([...CAMPOS, MOD, HOJA].map((f) => [nh(f.h), f]));

const pad = (n) => String(n).padStart(2, "0");

function aFecha(v) {
  let y, m, d, x;
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    x = new Date(v.getTime() + 43200000); // +12h: absorbe la deriva de segundos de SheetJS
    [y, m, d] = [x.getFullYear(), x.getMonth() + 1, x.getDate()];
  } else if (typeof v === "number") {
    x = new Date(Math.floor(v) * 86400000 + Date.UTC(1899, 11, 30)); // serial Excel (>= 61)
    [y, m, d] = [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
  } else {
    const s = String(v ?? "").trim();
    if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) [y, m, d] = [+x[1], +x[2], +x[3]];
    else if ((x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [y, m, d] = [+x[3], +x[2], +x[1]];
    else if ((x = s.match(/^(\d{1,2})\/(\d{4})$/))) [y, m, d] = [+x[2], +x[1], 1];
    else return null;
  }
  return y >= 1950 && y < 2200 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

function aNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[$\s]/g, "");
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return s && !isNaN(n) ? n : null;
}

function aValor(f, v) {
  if (v === null || v === undefined || v === "") return null;
  if (f.tipo === "date") return aFecha(v);
  if (f.tipo === "number") return aNum(v);
  const s = v instanceof Date ? aFecha(v) : String(v).trim();
  return s === "" ? null : s;
}

// ─── leerCuadro(arrayBuffer) → { filas, hojas, avisos } ───
// filas: [{ hoja, orden, ...campos }] solo con campos no vacíos. Encabezados por nombre, nunca por posición.
export function leerCuadro(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, sheetRows: 2000 });
  const filas = [], hojas = [], avisos = [], sinHoja = [];
  wb.SheetNames.forEach((name, si) => {
    const hoja = name.trim();
    if (/^(PLANTILLA|SMMLV)$/i.test(hoja)) { avisos.push(`Hoja "${hoja}" omitida (no es una constructora).`); return; }
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const hi = rows.slice(0, 20).findIndex((r) => {
      const hs = r.map(nh);
      return hs.includes("CONTRATO") && hs.includes("OBJETO");
    });
    if (hi < 0) { avisos.push(`Hoja "${hoja}" omitida: no se encontró la fila de encabezados (CONTRATO y OBJETO).`); return; }
    const cols = []; // [indiceColumna, campo]
    rows[hi].forEach((h, i) => { const f = h !== null && POR_ENCABEZADO.get(nh(h)); if (f) cols.push([i, f]); });
    const faltan = CAMPOS.filter((f) => !cols.some(([, g]) => g === f)).map((f) => f.key === "dias" || f.tipo === "calc" ? null : f.h).filter(Boolean);
    if (faltan.length) avisos.push(`Hoja "${hoja}": faltan columnas ${faltan.join(", ")}.`);
    const full = ws["!fullref"];
    if (full && XLSX.utils.decode_range(full).e.r >= 2000) avisos.push(`Hoja "${hoja}": solo se leyeron las primeras 2000 filas.`);
    const ini = filas.length;
    let n = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const fila = { hoja, orden: si * 10000 + r };
      for (const [i, f] of cols) {
        if (f.tipo === "calc") continue;
        const v = aValor(f, rows[r][i]);
        if (v !== null) { if (f === HOJA) fila.hoja = v.trim(); else fila[f.key] = v; }
      }
      if (!fila.contrato && !fila.objeto) continue;
      if (esBase(fila)) delete fila.modifica;
      else fila.modifica = MODIFICA.includes(norm(fila.modifica)) ? norm(fila.modifica) : inferirModifica(fila);
      filas.push(fila); n++;
    }
    if (cols.some(([, f]) => f === HOJA)) new Set(filas.slice(ini).map((f) => f.hoja)).forEach((h) => hojas.push(h));
    else { hojas.push(hoja); sinHoja.push(hoja); filas.slice(ini).forEach((f) => { f._sinHoja = true; }); } // sin columna HOJA: ver ubicarHojas
    if (!n) avisos.push(`Hoja "${hoja}": sin filas de datos.`);
  });
  return { filas, hojas, avisos, sinHoja };
}

// ─── Contratos ───
// Clave RTDB-segura: hoja|CONTRATO normalizado (sin . # $ [ ] /). Sin CONTRATO: hoja|objeto (40 primeros).
// La clave de un contrato existente no cambia nunca (alias, notas y comentarios cuelgan de ella).
export function contratoKey(hoja, fila) {
  const id = fila.contrato ? norm(fila.contrato) : norm(fila.objeto || "").slice(0, 40);
  return (norm(hoja) + "|" + id).replace(/[.#$[\]/\x00-\x1f]/g, "-");
}

// Identidad canónica para AGRUPAR: solo A–Z0–9 ("CO No. 1-MO" == "CO No.1-MO"). Sin contrato: objeto (40 primeros).
export const canon = (s) => norm(s).replace(/[^A-Z0-9]/g, "");
const grupoId = (hoja, f) => norm(hoja) + "|" + (canon(f.contrato) || "~" + canon(f.objeto).slice(0, 40));

export const esBase = (f) => !f.tipo || f.tipo.trim() === "---" || f.tipo.trim() === "";
export const esOtrosi = (f) => /OTROS/.test(norm(f.tipo));

// Qué modifica un otrosí/liquidación: TIEMPO, VALOR o TIEMPO Y VALOR (se deduce de TIPO/OBJETO si no está escrito).
export function inferirModifica(f) {
  const t = norm(f.tipo), o = norm(f.objeto);
  if (/LIQUIDAC/.test(t) || /SE LIQUIDA/.test(o)) return "TIEMPO Y VALOR";
  const ti = /TIEMPO|PLAZO|AMPLIACION/.test(o), va = /VALOR|DESCONTRATAC|MAYORES/.test(o);
  return ti && !va ? "TIEMPO" : va && !ti ? "VALOR" : "TIEMPO Y VALOR";
}
const conModifica = (f) => (esBase(f) || MODIFICA.includes(f.modifica) ? f : { ...f, modifica: inferirModifica(f) });

// Solo FINALIZADO deja de alarmar (EN LIQUIDACIÓN sigue alarmando).
export const esFinalizado = (estado) => /FINALIZAD/.test(norm(estado));

// Contrato con derivados. filas = [{tipo, ...campos}] (sin hoja/orden).
// Vigentes: fecha fin = la de la última fila que modifica TIEMPO; valor = el de la última que modifica VALOR; si no hay, el base.
export function armarContrato(key, hoja, contrato, orden, filas) {
  filas = filas.map(conModifica);
  const base = filas.find(esBase) || filas[0] || {};
  const ult = (m, k) => [...filas].reverse().find((f) => !esBase(f) && f.modifica.includes(m) && f[k] != null && f[k] !== "")?.[k];
  const estados = filas.map((f) => f.estado).filter(Boolean);
  return {
    key, hoja, contrato: contrato || "", orden, filas, base,
    sinContrato: !contrato,
    fechaFinVigente: ult("TIEMPO", "fechaFin") ?? base.fechaFin ?? null,
    valorVigente: ult("VALOR", "valor") ?? base.valor ?? null,
    estadoVigente: estados[estados.length - 1] || "",
    estadoEfectivo: norm(estados[estados.length - 1] || ""),
  };
}

// Agrupa filas por hoja + contrato canónico; filas en orden de aparición. La clave es la de la primera fila del grupo.
export function agruparContratos(filas) {
  const m = new Map();
  for (const { hoja, orden, _sinHoja, ...campos } of filas) {
    const g = grupoId(hoja, campos);
    if (!m.has(g)) m.set(g, { key: contratoKey(hoja, campos), hoja, contrato: campos.contrato || "", orden, filas: [] });
    m.get(g).filas.push(campos);
  }
  return [...m.values()].map((c) => armarContrato(c.key, c.hoja, c.contrato, c.orden, c.filas));
}

// Archivo sin columna HOJA (p. ej. export "una sola hoja" al que se le borró HOJA): la hoja del Excel ("Contratos") no es una
// constructora. Para cada fila _sinHoja cuyo nombre de hoja no es una hoja existente, busca el contrato por número canónico
// entre existentes ({key,hoja,contrato}), sin contar los de la hoja con ese mismo nombre. Una sola hoja candidata → fila.hoja.
// Las filas ubicadas (o de una hoja conocida) pierden _sinHoja; las no resueltas lo conservan. No muta la entrada.
// "Contratos" es el nombre de la hoja del export "una sola hoja": nunca cuenta como constructora conocida (en prod ya existe por el error).
export const hojasConocidas = (existentes) => new Set(existentes.map((e) => norm(e.hoja)).filter((h) => h !== "CONTRATOS"));
export function ubicarHojas(filas, existentes) {
  const conocidas = hojasConocidas(existentes);
  const porNum = new Map();
  for (const e of existentes) {
    const n = canon(e.contrato);
    if (n) { if (!porNum.has(n)) porNum.set(n, []); porNum.get(n).push(e); }
  }
  const ub = new Set(), amb = new Map(), sin = new Set();
  const out = filas.map((f) => {
    if (!f._sinHoja) return f;
    const { _sinHoja, ...r } = f;
    if (conocidas.has(norm(f.hoja))) return r;
    const n = canon(f.contrato), etq = f.contrato || f.objeto || "(sin número)";
    const hs = [...new Set((porNum.get(n) || []).filter((e) => norm(e.hoja) !== norm(f.hoja)).map((e) => e.hoja))];
    if (hs.length === 1) { ub.add(n); return { ...r, hoja: hs[0] }; }
    if (hs.length > 1) amb.set(n, { contrato: etq, hojas: hs }); else sin.add(etq);
    return f;
  });
  return { filas: out, ubicadas: ub.size, ambiguas: [...amb.values()], sinCoincidencia: [...sin] };
}

// Contrato leído de RTDB ({hoja, contrato, orden, filas}); Firebase puede devolver filas como objeto.
export function desdeDb(key, c) {
  const filas = Array.isArray(c.filas) ? c.filas : Object.values(c.filas || {});
  return armarContrato(key, c.hoja, c.contrato, c.orden ?? 0, filas.filter(Boolean));
}

// Memoria de uniones: alias = {keyOrigen: keyDestino}. En la carga, un grupo con alias se agrega (en orden de archivo)
// a las filas del destino (si el destino no viene en el archivo se parte de sus filas en RTDB, sin repetir las iguales).
// Cadenas A→B→C se siguen; un ciclo se ignora. Devuelve { cs, unidos }.
export function aplicarAlias(cs, alias, existentes = {}) {
  const destino = (k) => {
    const vistos = new Set([k]);
    for (let t = k; ; ) {
      if (!alias[t]) return t;
      t = alias[t];
      if (vistos.has(t)) return null;
      vistos.add(t);
    }
  };
  const g = new Map(cs.map((c) => [c.key, { c, filas: null }]));
  let unidos = 0;
  for (const c of cs) {
    const t = destino(c.key);
    if (!t || t === c.key) continue;
    let d = g.get(t);
    if (!d && existentes[t]) { const e = desdeDb(t, existentes[t]); d = { c: e, filas: [...e.filas], db: true }; g.set(t, d); }
    if (!d) continue;
    d.filas ||= [...d.c.filas];
    const hay = new Set(d.db ? d.filas.map((f) => JSON.stringify(f)) : []);
    for (const f of c.filas) if (!hay.has(JSON.stringify(f))) d.filas.push(f);
    g.delete(c.key); unidos++;
  }
  return { unidos, cs: [...g.values()].map(({ c, filas }) => (filas ? armarContrato(c.key, c.hoja, c.contrato, c.orden, filas) : c)) };
}

// Une filas de origen a las de destino: por FECHA DE INICIO si todas la tienen (orden estable), si no al final.
export function unirFilas(dst, src) {
  const t = [...dst, ...src];
  return t.every((f) => f.fechaInicio) ? t.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)) : t;
}

// "OTROSI NO- 2" -> "OTROSÍ No. 2", "LIQUIDACION" -> "LIQUIDACIÓN"; null si el texto no es una etiqueta de otrosí/liquidación.
const ES_ETIQUETA = /OTROSI|LIQUIDAC/;
export function etiquetaOtrosi(contrato) {
  const m = norm(contrato).match(/(OTROSI|LIQUIDAC[A-Z]*)[^A-Z0-9]*(?:NO[^A-Z0-9]*)?([0-9]+)?/);
  return !m ? null : m[1] === "OTROSI" ? `OTROSÍ${m[2] ? " No. " + m[2] : ""}` : "LIQUIDACIÓN";
}

// Cambios (un solo update en la raíz de RTDB) para pasar a `dst` todo el contrato `src` o, con idx, solo esa fila.
// Contrato completo (o con una sola fila): borra src, guarda alias src→dst y mueve sus comentarios (nuevoId() = push key).
// contratos/notas = valores de contratosExcel/contratos y contratosNotas.
export function planMover(contratos, notas, src, dst, idx, nuevoId) {
  const s = desdeDb(src, contratos[src]), d = desdeDb(dst, contratos[dst]);
  const S = s.filas, D = d.filas;
  const todo = idx == null || S.length < 2;
  // Si el CONTRATO del origen es una etiqueta de otrosí/liquidación, sus filas toman esa etiqueta como TIPO y el contrato del destino.
  const eti = etiquetaOtrosi(s.contrato);
  const mover = (todo ? S : [S[idx]]).map((f) => (eti ? { ...f, ...(esBase(f) ? { tipo: eti } : {}), contrato: d.contrato || f.contrato } : f));
  const upd = { [`contratosExcel/contratos/${dst}/filas`]: unirFilas(D, mover) };
  if (!todo) return { ...upd, [`contratosExcel/contratos/${src}/filas`]: S.filter((_, i) => i !== idx) };
  upd[`contratosExcel/contratos/${src}`] = null;
  upd[`contratosAlias/${src}`] = dst;
  const n = notas?.[src];
  if (n) {
    for (const m of Object.values(n.comentarios || {})) upd[`contratosNotas/${dst}/comentarios/${nuevoId()}`] = m;
    if (n.fechaCompromiso && !notas[dst]?.fechaCompromiso) upd[`contratosNotas/${dst}/fechaCompromiso`] = n.fechaCompromiso;
    upd[`contratosNotas/${src}`] = null;
  }
  return upd;
}

// Sugerencias de contratos mal agrupados. cs = contratos armados (armarContrato/desdeDb). → [{key, destino, razon}]
//  (i) misma hoja y mismo contrato canónico con claves distintas;
//  (iv) el CONTRATO es una etiqueta de otrosí/liquidación ("OTROSI NO- 2", "CPF-5551 OTROSI NO- 1"): va al contrato de su prefijo
//       o, sin prefijo, al contrato anterior de la hoja que no sea otra etiqueta;
//  (ii) sin número o sin fila base (todo otrosí/liquidación) con el mismo proyecto que un contrato anterior de su hoja.
// "CO-1" y "CO-1-MO" son contratos distintos: no se sugieren.
export function sugerencias(cs) {
  const out = [], hojas = new Map();
  [...cs].sort((a, b) => a.orden - b.orden).forEach((c) => { const h = norm(c.hoja); hojas.set(h, [...(hojas.get(h) || []), c]); });
  const tieneBase = (c) => c.filas.some(esBase);
  for (const lista of hojas.values()) {
    const ids = new Map();
    for (const c of lista) { const id = canon(c.contrato); if (id) ids.set(id, [...(ids.get(id) || []), c]); }
    const hechos = new Set();
    for (const arr of ids.values()) {
      if (arr.length < 2) continue;
      const dst = arr.find(tieneBase) || arr[0];
      for (const c of arr) if (c !== dst) { hechos.add(c.key); out.push({ key: c.key, destino: dst.key, razon: `Mismo contrato que "${dst.contrato}" escrito distinto` }); }
    }
    const esEti = (c) => ES_ETIQUETA.test(norm(c.contrato));
    for (const c of lista) {
      if (!esEti(c) || hechos.has(c.key)) continue;
      const pre = canon(norm(c.contrato).split(/OTROSI|LIQUIDAC/)[0]);
      const dst = pre ? lista.find((d) => d !== c && !esEti(d) && canon(d.contrato).includes(pre)) : [...lista].reverse().find((d) => d.orden < c.orden && !esEti(d));
      if (dst) { hechos.add(c.key); out.push({ key: c.key, destino: dst.key, razon: `El número de contrato parece un otrosí${pre ? ` (prefijo "${pre}")` : ""}` }); }
    }
    for (const c of lista) {
      if (hechos.has(c.key) || (c.contrato && tieneBase(c))) continue;
      const p = canon(c.base.proyecto);
      if (!p) continue;
      const dst = [...lista].reverse().find((d) => d.orden < c.orden && tieneBase(d) && canon(d.base.proyecto) === p);
      if (dst) out.push({ key: c.key, destino: dst.key, razon: `${c.contrato ? "Sin fila de contrato" : "Sin número de contrato"}; mismo proyecto que "${dst.contrato || "sin número"}"` });
    }
  }
  return out;
}

// `orden` para un contrato nuevo: al final de su hoja, o al final de todo (+10000) si la hoja es nueva.
// contratos = [{hoja, orden}] (los de RTDB).
export function siguienteOrden(contratos, hoja) {
  const ords = contratos.filter((c) => norm(c.hoja) === norm(hoja)).map((c) => c.orden ?? 0);
  if (ords.length) return Math.max(...ords) + 1;
  return Math.max(0, ...contratos.map((c) => c.orden ?? 0)) + 10000 + 1;
}

// Fila nueva (otrosí/liquidación) copiando los campos identificadores de la fila base.
export function filaNueva(base, filas, liquidacion) {
  const f = { tipo: liquidacion ? "LIQUIDACIÓN" : `OTROSÍ No. ${filas.filter(esOtrosi).length + 1}` };
  for (const k of ["encargado", "entidad", "nit", "proyecto", "direccion", "localizacion", "contrato"]) if (base[k]) f[k] = base[k];
  f.modifica = inferirModifica(f);
  return f;
}

// Días entre dos "YYYY-MM-DD" (null si falta alguno).
export function diasEntre(ini, fin) {
  if (!ini || !fin) return null;
  const d = (new Date(fin + "T00:00:00") - new Date(ini + "T00:00:00")) / 86400000;
  return isNaN(d) ? null : Math.round(d);
}

// ─── Export, mismo formato que el Cuadro ───
// formato: "hoja" = una hoja por constructora | "unica" = hoja "Contratos" con columna HOJA al inicio.
// contenido: "completo" = contrato con otrosíes y liquidaciones | "general" = una fila por contrato (fila base con valor,
// fecha de terminación y estado vigentes). Siempre termina con la columna MODIFICA.
const MONEY = '_-"$"* #,##0_-;\\-"$"* #,##0_-;_-"$"* "-"??_-;_-@_-';
const serial = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return y ? Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569 : null;
};

export function construirLibro(contratos, { formato = "hoja", contenido = "completo" } = {}) {
  const unica = formato === "unica";
  const cols = [...(unica ? [HOJA] : []), ...CAMPOS, MOD];
  const L = (k) => XLSX.utils.encode_col(cols.findIndex((f) => f.key === k));
  const porHoja = new Map();
  [...contratos].sort((a, b) => (unica ? a.hoja.localeCompare(b.hoja) : 0) || a.orden - b.orden).forEach((c) => {
    const h = unica ? "Contratos" : c.hoja;
    if (!porHoja.has(h)) porHoja.set(h, []);
    porHoja.get(h).push(c);
  });
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const hoy = Math.floor(Date.now() / 86400000) + 25569;

  for (const [hoja, cs] of porHoja) {
    const ws = {};
    cols.forEach((f, i) => { ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { t: "s", v: f.h }; });
    let r = 1;
    for (const c of cs) {
      const filas = contenido === "general" ? [{ ...c.base, valor: c.valorVigente, fechaFin: c.fechaFinVigente, estado: c.estadoVigente }] : c.filas;
      for (const f0 of filas) {
        const fila = { ...f0, _hoja: c.hoja };
        cols.forEach((f, i) => {
          const v = fila[f.key];
          if (f.tipo === "calc" || v === undefined || v === null || v === "") return;
          const ref = XLSX.utils.encode_cell({ r, c: i });
          if (f.tipo === "date") { const s = serial(v); if (s) ws[ref] = { t: "n", v: s, z: "d/mm/yyyy" }; }
          else if (f.tipo === "number") ws[ref] = { t: "n", v: Number(v), z: MONEY };
          else ws[ref] = { t: "s", v: String(v) };
        });
        if (fila.fechaInicio && fila.fechaFin) {
          const n = r + 1, ini = serial(fila.fechaInicio), fin = serial(fila.fechaFin);
          const put = (k, cell) => { ws[L(k) + n] = cell; };
          put("dias", { t: "n", f: `${L("fechaFin")}${n}-${L("fechaInicio")}${n}`, v: fin - ini, z: "0" });
          put("meses", { t: "n", f: `${L("dias")}${n}/30`, v: (fin - ini) / 30, z: "0.0" });
          put("diasEj", { t: "n", f: `${L("fechaInicio")}${n}+${L("dias")}${n}-TODAY()`, v: fin - hoy, z: "0" });
        }
        r++;
      }
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, 0), c: cols.length - 1 } });
    ws["!cols"] = cols.map((f) => ({ wch: f.w }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    let name = hoja.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31).trim() || "SIN HOJA";
    for (let n = 2; usados.has(name.toLowerCase()); n++) name = name.slice(0, 28).trim() + " " + n;
    usados.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

// ─── Permisos (contratosPermisos/{userId} = { editar: "ninguno"|"todo"|"hojas", hojas: {hojaKey: true}, eliminar: bool }) ───
// La interfaz los aplica; la base no (el portal no usa Firebase Auth). Solo el admin los asigna.
// Clave RTDB-segura de una hoja (misma normalización que contratoKey).
export const hojaKey = (h) => norm(h).replace(/[.#$[\]/\x00-\x1f]/g, "-");

// admin: todo y eliminar siempre (ignora el registro). Sin registro: contabilidad edita todo sin eliminar; el resto, solo ver.
export function permisosContratos(user, registro) {
  if (user?.role === "admin") return { editarTodo: true, puedeEditarHoja: () => true, puedeEliminar: true, puedeEliminarHoja: () => true, soloLectura: false };
  const r = registro || (user?.role === "contabilidad" ? { editar: "todo" } : {});
  const editarTodo = r.editar === "todo";
  const hojas = r.editar === "hojas" ? r.hojas || {} : {};
  const puedeEditarHoja = (h) => editarTodo || !!hojas[hojaKey(h)];
  const puedeEliminar = !!r.eliminar;
  return { editarTodo, puedeEditarHoja, puedeEliminar, puedeEliminarHoja: (h) => puedeEliminar && puedeEditarHoja(h), soloLectura: !editarTodo && !Object.values(hojas).some(Boolean) };
}

// ─── Historial + cambios multi-path ───
// Cada plan* devuelve un objeto para un único update en la RAÍZ de RTDB (rutas sin prefijo de prueba: aplicarCambios lo agrega),
// que incluye su registro en contratosHistorial/{pushId}. ctx = { usuario, nuevoId() -> pushId, at? }.
const CX = "contratosExcel/contratos/";
const limpia = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const hist = (ctx, accion, c, extra = {}) => ({
  [`contratosHistorial/${ctx.nuevoId()}`]: limpia({ at: ctx.at || new Date().toISOString(), usuario: ctx.usuario, accion, hoja: c.hoja, contratoKey: c.key, contrato: c.contrato, ...extra }),
});
const nombreFila = (f) => (f && f.tipo && f.tipo.trim() !== "---" ? f.tipo : "Contrato");

export const filaSinIndice = (filas, idx) => filas.filter((_, i) => i !== idx);

export function planEditarCampo(c, idx, campo, antes, despues, ctx) {
  return { [`${CX}${c.key}/filas/${idx}/${campo}`]: despues ?? null, ...hist(ctx, "editar campo", c, { campo, antes: antes ?? null, despues: despues ?? null, detalle: `${nombreFila(c.filas?.[idx])} (fila ${idx + 1})` }) };
}

export function planCrearContrato(key, data, ctx) {
  return { [CX + key]: data, ...hist(ctx, "crear contrato", { key, hoja: data.hoja, contrato: data.contrato }) };
}

export function planAgregarFila(c, idx, fila, ctx) {
  return { [`${CX}${c.key}/filas/${idx}`]: fila, ...hist(ctx, "agregar otrosí/liquidación", c, { detalle: fila.tipo }) };
}

export function planEliminarContrato(contratos, key, ctx) {
  const c = desdeDb(key, contratos[key]);
  return { [CX + key]: null, ...hist(ctx, "eliminar contrato", c, { detalle: `${c.filas.length} fila(s)` }) };
}

// Quita una fila; si era la única elimina el contrato.
export function planEliminarFila(contratos, key, idx, ctx) {
  const c = desdeDb(key, contratos[key]);
  if (!c.filas[idx]) throw new Error("La fila no existe");
  if (c.filas.length < 2) return planEliminarContrato(contratos, key, ctx);
  return { [`${CX}${key}/filas`]: filaSinIndice(c.filas, idx), ...hist(ctx, "eliminar fila", c, { detalle: `${nombreFila(c.filas[idx])} (fila ${idx + 1})` }) };
}

// Borra todos los contratos de la hoja (las notas no se tocan).
export function planEliminarHoja(contratos, hoja, ctx) {
  const claves = Object.keys(contratos).filter((k) => contratos[k].hoja === hoja);
  if (!claves.length) throw new Error("La constructora no tiene contratos");
  const upd = Object.fromEntries(claves.map((k) => [CX + k, null]));
  return { ...upd, ...hist(ctx, "eliminar constructora", { hoja }, { detalle: `${claves.length} contrato(s)`, claves }) };
}

// planMover + su registro. accion: "unir" | "aplicar sugerencia" (si solo se mueve una fila queda "mover fila").
export function planUnir(contratos, notas, src, dst, idx, ctx, accion = "unir") {
  const s = desdeDb(src, contratos[src]), d = desdeDb(dst, contratos[dst]);
  const todo = idx == null || s.filas.length < 2;
  return { ...planMover(contratos, notas, src, dst, idx, ctx.nuevoId), ...hist(ctx, todo ? accion : "mover fila", s, { detalle: `${s.hoja} · ${s.contrato || "(sin número)"} → ${d.hoja} · ${d.contrato || "(sin número)"}`, destino: dst }) };
}

export function planComentario(c, m, ctx) {
  return { [`contratosNotas/${c.key}/comentarios/${ctx.nuevoId()}`]: m, ...hist(ctx, "seguimiento", c, { detalle: `Comentario: ${m.texto.slice(0, 200)}` }) };
}
export function planFecha(c, fecha, ctx) {
  const antes = c.nota?.fechaCompromiso;
  return { [`contratosNotas/${c.key}/fechaCompromiso`]: fecha || null, ...hist(ctx, "seguimiento", c, { detalle: `Fecha de compromiso: ${antes || "—"} → ${fecha || "—"}` }) };
}
export function planIgnorarSug(c, ctx) {
  return { [`contratosNotas/${c.key}/ignorarSugerencia`]: true, ...hist(ctx, "seguimiento", c, { detalle: "Sugerencia ignorada" }) };
}

// Carga de Excel: crea/reemplaza SOLO los contratos recibidos (orden ya resuelto) y _meta. Un único registro con las claves.
export function planCarga(contratos, meta, ctx) {
  const upd = { "contratosExcel/_meta": meta };
  for (const c of contratos) upd[CX + c.key] = { hoja: c.hoja, contrato: c.contrato, orden: c.orden, actualizadoAt: meta.at, actualizadoPor: meta.autor, archivo: meta.archivo, filas: c.filas };
  return { ...upd, ...hist({ ...ctx, at: meta.at }, "subir excel", {}, { detalle: `${meta.archivo}: ${meta.nuevos} nuevos, ${meta.actualizados} actualizados`, archivo: meta.archivo, nuevos: meta.nuevos, actualizados: meta.actualizados, claves: contratos.map((c) => c.key) }) };
}
