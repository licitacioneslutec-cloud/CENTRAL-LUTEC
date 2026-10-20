// ─── Firebase helpers for the Contratos module ───
// contratosMonday: copy of the Monday board, fully replaced by n8n on each sync.
// contratosNotas/{id}: portal-only { fechaCompromiso, comentarios: {pushId: {texto, autor, at}} }.
import { ref, onValue, update, push, set } from "firebase/database";

// Calls cb({monday, notas}) whenever either path changes. Returns a combined unsubscribe fn.
export function subscribeContratos(db, cb) {
  let monday = null, notas = null;
  const emit = () => cb({ monday, notas });
  const u1 = onValue(ref(db, "contratosMonday"), (s) => { monday = s.val(); emit(); });
  const u2 = onValue(ref(db, "contratosNotas"), (s) => { notas = s.val(); emit(); });
  return () => { u1(); u2(); };
}

export function addComentario(db, id, { texto, autor, at }) {
  return set(push(ref(db, `contratosNotas/${id}/comentarios`)), { texto, autor, at });
}

export function setFechaCompromiso(db, id, fecha) {
  return update(ref(db, `contratosNotas/${id}`), { fechaCompromiso: fecha || null });
}
