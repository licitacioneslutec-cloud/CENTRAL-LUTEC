// ─── Firebase helpers for the Contratos module ───
// contratosExcel/contratos/{contratoKey}: { hoja, contrato, orden, actualizadoAt, actualizadoPor, archivo, filas: [{tipo, ...campos}] }
// contratosAlias/{keyOrigen}: keyDestino — memoria de uniones: una carga con el contrato origen lo agrega al destino.
// contratosExcel/_meta: { at, autor, archivo, nuevos, actualizados } de la última carga.
// contratosNotas/{contratoKey}: portal-only { fechaCompromiso, ignorarSugerencia, comentarios: {pushId: {texto, autor, at}} }. Las cargas no lo tocan.
import { ref, onValue, update, push, set, remove } from "firebase/database";

// Calls cb({excel, notas, alias}) whenever any path changes. Returns a combined unsubscribe fn.
export function subscribeContratos(db, cb) {
  let excel = null, notas = null, alias = null;
  const emit = () => cb({ excel, notas, alias });
  const u1 = onValue(ref(db, "contratosExcel"), (s) => { excel = s.val(); emit(); });
  const u2 = onValue(ref(db, "contratosNotas"), (s) => { notas = s.val(); emit(); });
  const u3 = onValue(ref(db, "contratosAlias"), (s) => { alias = s.val(); emit(); });
  return () => { u1(); u2(); u3(); };
}

// Un solo update multi-path: crea/reemplaza SOLO los contratos recibidos (con `orden` ya resuelto) y _meta. Nunca borra otros.
export function guardarCarga(db, contratos, meta) {
  const upd = { _meta: meta };
  for (const c of contratos) {
    upd[`contratos/${c.key}`] = { hoja: c.hoja, contrato: c.contrato, orden: c.orden, actualizadoAt: meta.at, actualizadoPor: meta.autor, archivo: meta.archivo, filas: c.filas };
  }
  return update(ref(db, "contratosExcel"), upd);
}

// Edita un campo de una fila del contrato; ""/undefined/null lo borra.
export function setCampoFila(db, key, idx, campo, value) {
  return update(ref(db, `contratosExcel/contratos/${key}/filas/${idx}`), { [campo]: value === "" || value === undefined ? null : value });
}

// Crea un contrato nuevo (set en su ruta; el llamador ya verificó que la clave no existe).
export function crearContrato(db, key, data) {
  return set(ref(db, `contratosExcel/contratos/${key}`), data);
}

// Agrega una fila (otrosí/liquidación) en la posición idx = largo actual de filas.
export function agregarFila(db, key, idx, fila) {
  return set(ref(db, `contratosExcel/contratos/${key}/filas/${idx}`), fila);
}

export function eliminarContrato(db, key) {
  return remove(ref(db, `contratosExcel/contratos/${key}`));
}

export function addComentario(db, key, { texto, autor, at }) {
  return set(push(ref(db, `contratosNotas/${key}/comentarios`)), { texto, autor, at });
}

// Un solo update multi-path en la raíz (uniones/movimientos: ver planMover en contratosExcel.js).
export function aplicarCambios(db, upd) {
  return update(ref(db), upd);
}

export const nuevoId = (db) => push(ref(db, "contratosNotas")).key;

export function ignorarSugerencia(db, key) {
  return update(ref(db, `contratosNotas/${key}`), { ignorarSugerencia: true });
}

export function setFechaCompromiso(db, key, fecha) {
  return update(ref(db, `contratosNotas/${key}`), { fechaCompromiso: fecha || null });
}
