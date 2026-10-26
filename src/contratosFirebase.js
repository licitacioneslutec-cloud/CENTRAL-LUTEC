// ─── Firebase helpers for the Contratos module ───
// contratosExcel/contratos/{contratoKey}: { hoja, contrato, orden, actualizadoAt, actualizadoPor, archivo, filas: [{tipo, ...campos}] }
// contratosAlias/{keyOrigen}: keyDestino — memoria de uniones: una carga con el contrato origen lo agrega al destino.
// contratosExcel/_meta: { at, autor, archivo, nuevos, actualizados } de la última carga.
// contratosNotas/{contratoKey}: portal-only { fechaCompromiso, ignorarSugerencia, comentarios: {pushId: {texto, autor, at}} }. Las cargas no lo tocan.
// contratosPermisos/{userId}: { editar: "ninguno"|"todo"|"hojas", hojas: {hojaKey: true}, eliminar } — solo el admin los escribe.
// contratosHistorial/{pushId}: { at, usuario, accion, hoja, contratoKey, contrato, detalle, ... } — se escribe en el mismo update que el cambio.
// Modo prueba (VITE_CONTRATOS_PRUEBA=1 en .env.local): TODAS esas rutas llevan el prefijo "pruebas/" (única puerta: p()).
import { ref, onValue, update, push, set, get, query, orderByKey, limitToLast, endBefore } from "firebase/database";

export const MODO_PRUEBA = import.meta.env?.VITE_CONTRATOS_PRUEBA === "1";
export const p = (ruta) => (MODO_PRUEBA ? "pruebas/" : "") + ruta;

// Calls cb({excel, notas, alias}) whenever any path changes. Returns a combined unsubscribe fn.
export function subscribeContratos(db, cb) {
  let excel = null, notas = null, alias = null;
  const emit = () => cb({ excel, notas, alias });
  const u1 = onValue(ref(db, p("contratosExcel")), (s) => { excel = s.val(); emit(); });
  const u2 = onValue(ref(db, p("contratosNotas")), (s) => { notas = s.val(); emit(); });
  const u3 = onValue(ref(db, p("contratosAlias")), (s) => { alias = s.val(); emit(); });
  return () => { u1(); u2(); u3(); };
}

// Único punto de escritura del módulo: update multi-path en la raíz; las claves vienen sin prefijo (ver plan* en contratosExcel.js).
export function aplicarCambios(db, upd) {
  return update(ref(db), Object.fromEntries(Object.entries(upd).map(([k, v]) => [p(k), v])));
}

export const nuevoId = (db) => push(ref(db, p("contratosHistorial"))).key;

// ─── Permisos ───
export const subscribePermisos = (db, userId, cb) => onValue(ref(db, p(`contratosPermisos/${userId}`)), (s) => cb(s.val()));
export const subscribePermisosTodos = (db, cb) => onValue(ref(db, p("contratosPermisos")), (s) => cb(s.val() || {}));
export const guardarPermisos = (db, userId, reg) => set(ref(db, p(`contratosPermisos/${userId}`)), reg);
// Nombres de hojas (constructoras) existentes.
export async function listarHojas(db) {
  const v = (await get(ref(db, p("contratosExcel/contratos")))).val() || {};
  return [...new Set(Object.values(v).map((c) => c.hoja).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// ─── Historial (las claves push son cronológicas: orden por clave) ───
const filasHist = (s) => { const r = []; s.forEach((x) => { r.push({ ...x.val(), id: x.key }); }); return r.reverse(); }; // más reciente primero
export const subscribeHistorial = (db, n, cb) => onValue(query(ref(db, p("contratosHistorial")), orderByKey(), limitToLast(n)), (s) => cb(filasHist(s)));
export async function masHistorial(db, antesDeId, n) {
  return filasHist(await get(query(ref(db, p("contratosHistorial")), orderByKey(), endBefore(antesDeId), limitToLast(n))));
}

// Solo modo prueba: copia contratosExcel y contratosAlias de producción (solo lectura, sin prefijo) a pruebas/.
export async function copiarProdAPrueba(db) {
  if (!MODO_PRUEBA) throw new Error("Solo disponible en modo prueba");
  for (const ruta of ["contratosExcel", "contratosAlias"]) {
    const v = (await get(ref(db, ruta))).val();
    await set(ref(db, p(ruta)), v ?? null);
  }
}
