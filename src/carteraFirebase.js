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
