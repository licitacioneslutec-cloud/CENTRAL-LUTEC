// ─── Firebase CRUD helpers for the Documentos Proveedor module ───
// Structure: documentosProveedor/{pushId}
import { ref, onValue, set, update, remove, push } from "firebase/database";
import { toSafeKey } from "./firebase";

// Subscribes to documentosProveedor/ in real time. Calls callback(data) on
// every change (data is Firebase's object of {id: documento} or null).
// Returns an unsubscribe fn.
export function subscribeDocumentos(db, callback) {
  return onValue(ref(db, "documentosProveedor"), (snapshot) => callback(snapshot.val()));
}

// Writes (overwrites) one documento at documentosProveedor/{id}.
export function writeDocumento(db, id, data) {
  return set(ref(db, `documentosProveedor/${toSafeKey(id)}`), data);
}

// Creates one documento with a Firebase-generated key. Returns the new id.
export function addDocumento(db, data) {
  const newRef = push(ref(db, "documentosProveedor"));
  return set(newRef, data).then(() => newRef.key);
}

// Updates specific fields of one documento without overwriting the rest.
export function updateDocumento(db, id, fields) {
  return update(ref(db, `documentosProveedor/${toSafeKey(id)}`), fields);
}

// Removes one documento.
export function removeDocumento(db, id) {
  return remove(ref(db, `documentosProveedor/${toSafeKey(id)}`));
}

// Removes every documento.
export function removeAllDocumentos(db) {
  return remove(ref(db, "documentosProveedor"));
}
