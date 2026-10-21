// ─── Firebase helpers for the Contratos module ───
// contratosExcel/contratos/{contratoKey}: { hoja, contrato, orden, actualizadoAt, actualizadoPor, archivo, filas: [{tipo, ...campos}] }
// contratosExcel/_meta: { at, autor, archivo, nuevos, actualizados } de la última carga.
// contratosNotas/{contratoKey}: portal-only { fechaCompromiso, comentarios: {pushId: {texto, autor, at}} }. Las cargas no lo tocan.
import { ref, onValue, update, push, set, remove } from "firebase/database";

// Calls cb({excel, notas}) whenever either path changes. Returns a combined unsubscribe fn.
export function subscribeContratos(db, cb) {
  let excel = null, notas = null;
  const emit = () => cb({ excel, notas });
  const u1 = onValue(ref(db, "contratosExcel"), (s) => { excel = s.val(); emit(); });
  const u2 = onValue(ref(db, "contratosNotas"), (s) => { notas = s.val(); emit(); });
  return () => { u1(); u2(); };
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

export function eliminarContrato(db, key) {
  return remove(ref(db, `contratosExcel/contratos/${key}`));
}

export function addComentario(db, key, { texto, autor, at }) {
  return set(push(ref(db, `contratosNotas/${key}/comentarios`)), { texto, autor, at });
}

export function setFechaCompromiso(db, key, fecha) {
  return update(ref(db, `contratosNotas/${key}`), { fechaCompromiso: fecha || null });
}
