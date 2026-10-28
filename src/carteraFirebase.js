// ─── Firebase helpers for the Cartera module ───
// cartera/cortes/{YYYY-MM-DD}: { at, autor, archivo, facturas } — pesado: nunca suscribirse a todos.
// cartera/resumen/{YYYY-MM-DD}: resumenCorte() + { at, autor, archivo } — liviano: lista de cortes y evolución.
// Modo prueba: mismo prefijo "pruebas/" que Contratos (p()).
import { ref, onValue, update, get } from "firebase/database";
import { p } from "./contratosFirebase";

export const subscribeResumenes = (db, cb) => onValue(ref(db, p("cartera/resumen")), (s) => cb(s.val() || {}));

export async function leerCorte(db, fecha) {
  return (await get(ref(db, p(`cartera/cortes/${fecha}`)))).val()?.facturas || null;
}

// Un solo update multi-path: el corte y su resumen se escriben juntos o ninguno.
export function guardarCorte(db, fecha, corte, resumen) {
  return update(ref(db), {
    [p(`cartera/cortes/${fecha}`)]: corte,
    [p(`cartera/resumen/${fecha}`)]: { ...resumen, at: corte.at, autor: corte.autor, archivo: corte.archivo },
  });
}

// ─── Cruce con banco ───
// cartera/banco/{id}: notas crédito del extracto; cartera/conciliacion/{id}: { estado, facturas, suma, diferencia, tipo, cliente, ... };
// cartera/alias/{terceroNorm}: nit (memoria de a qué cliente corresponde un Tercero).
export const subscribeRuta = (db, ruta, cb) => onValue(ref(db, p(ruta)), (s) => cb(s.val() || {}));

// Re-subir actualiza los datos del movimiento (Tercero/Fin) sin tocar las conciliaciones.
export const guardarBanco = (db, movs) => update(ref(db), Object.fromEntries(Object.entries(movs).map(([id, m]) => [p(`cartera/banco/${id}`), m])));

// reg null = reabrir. Conciliación y alias en un solo update.
export function guardarConciliacion(db, id, reg, alias) {
  const u = { [p(`cartera/conciliacion/${id}`)]: reg };
  if (alias) u[p(`cartera/alias/${alias.key}`)] = alias.nit;
  return update(ref(db), u);
}
