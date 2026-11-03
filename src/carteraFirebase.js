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

// Re-subir actualiza los datos del movimiento (Tercero/Fin, cargaId/archivo) sin tocar las conciliaciones.
// carga = { id, reg } → cartera/bancoCargas/{id} en el mismo update (reg = {archivo, at, autor, n, desde, hasta}).
export function guardarBanco(db, movs, carga) {
  const u = Object.fromEntries(Object.entries(movs).map(([id, m]) => [p(`cartera/banco/${id}`), m]));
  if (carga) u[p(`cartera/bancoCargas/${carga.id}`)] = carga.reg;
  return update(ref(db), u);
}

// upd de planEliminarCarga (rutas sin prefijo de modo prueba)
export const aplicarPlan = (db, upd) => update(ref(db), Object.fromEntries(Object.entries(upd).map(([k, v]) => [p(k), v])));

// reg null = reabrir. Conciliación y alias en un solo update.
export function guardarConciliacion(db, id, reg, alias) {
  const u = { [p(`cartera/conciliacion/${id}`)]: reg };
  if (alias) u[p(`cartera/alias/${alias.key}`)] = alias.nit;
  return update(ref(db), u);
}

// ─── Conciliación de proveedores ───
// cxp/conciliaciones/{nit}/{fecha}: { at, autor, archivos, lutec[], prov[], apto[] } (fuentes; las filas se calculan con conciliar) — pesado: solo get. Los registros viejos solo traen `filas`.
// cxp/revision/{nit}/{claveFila}: { par?, estado?, nota?, autor, at, firma } — por proveedor, sobrevive a nuevas cargas.
// cxp/resumen/{nit}/{fecha}: resumenConc() + { at, autor, archivos } — liviano, suscrito.
// cxp/proveedores/{nit}: { nombre, nit, mapeo, mapeoApto }.
export async function leerConciliacion(db, nit, fecha) {
  return (await get(ref(db, p(`cxp/conciliaciones/${nit}/${fecha}`)))).val();
}

// Un solo update multi-path; JSON descarta los undefined (RTDB los rechaza).
export function guardarConciliacionCxp(db, nk, fecha, { prov, conc, resumen }) {
  const limpio = (x) => JSON.parse(JSON.stringify(x));
  return update(ref(db), {
    [p(`cxp/conciliaciones/${nk}/${fecha}`)]: limpio(conc),
    [p(`cxp/resumen/${nk}/${fecha}`)]: limpio({ ...resumen, at: conc.at, autor: conc.autor, archivos: conc.archivos }),
    [p(`cxp/proveedores/${nk}`)]: limpio(prov),
  });
}

// cambios = { claveFila: registro | null }; un solo update, y si viene `resumen` se refrescan nDocs/porCat de esa fecha.
export function guardarRevision(db, nk, cambios, fecha, resumen) {
  const u = Object.fromEntries(Object.entries(cambios).map(([k, v]) => [p(`cxp/revision/${nk}/${k}`), v]));
  if (resumen) { u[p(`cxp/resumen/${nk}/${fecha}/nDocs`)] = resumen.nDocs; u[p(`cxp/resumen/${nk}/${fecha}/porCat`)] = resumen.porCat; }
  return update(ref(db), JSON.parse(JSON.stringify(u)));
}
