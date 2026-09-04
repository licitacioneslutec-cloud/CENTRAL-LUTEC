// ─── Firebase (Realtime Database) config and CRUD helpers ───
// One Firebase project shared by all internal modules.
// Structure: facturas/{cufeHash}, config/estados
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, get, remove, push } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// True once real credentials are set; lets the app fall back to sample data until then.
export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey);
}

let dbInstance = null;

// Initializes the Firebase app and returns the Realtime Database instance. Call once.
export function initFirebase() {
  if (!dbInstance) {
    const app = initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}

// Firebase RTDB keys can't contain . # $ [ ] — replace them so a CUFE is a safe key.
export function toSafeKey(cufe) {
  return String(cufe).replace(/[.#$[\]]/g, "_");
}

// Subscribes to facturas/ in real time. Calls callback(data) on every change
// (data is Firebase's object of {cufeHash: factura} or null). Returns an unsubscribe fn.
export function subscribeFacturas(db, callback) {
  const facturasRef = ref(db, "facturas");
  return onValue(facturasRef, (snapshot) => callback(snapshot.val()));
}

// Writes (overwrites) one factura at facturas/{cufeHash}.
export function writeFactura(db, cufeHash, data) {
  return set(ref(db, `facturas/${toSafeKey(cufeHash)}`), data);
}

// Updates specific fields of one factura without overwriting the rest.
export function updateFactura(db, cufeHash, fields) {
  return update(ref(db, `facturas/${toSafeKey(cufeHash)}`), fields);
}

// Removes one factura.
export function removeFactura(db, cufeHash) {
  return remove(ref(db, `facturas/${toSafeKey(cufeHash)}`));
}

// Removes all facturas.
export function removeAllFacturas(db) {
  return remove(ref(db, "facturas"));
}

// Reads config/estados once. Returns a promise resolving to an array of estado strings.
export async function loadEstados(db) {
  const snapshot = await get(ref(db, "config/estados"));
  return snapshot.exists() ? snapshot.val() : [];
}

// ─── User management ───
export function subscribeUsers(db, callback) {
  return onValue(ref(db, "users"), (snapshot) => callback(snapshot.val()));
}

export function createUser(db, userData) {
  const newRef = push(ref(db, "users"));
  return set(newRef, userData).then(() => newRef.key);
}

export function deleteUser(db, userId) {
  return remove(ref(db, "users/" + userId));
}

export async function getUsers(db) {
  const snapshot = await get(ref(db, "users"));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function seedAdmin(db, adminHash) {
  const users = await getUsers(db);
  if (users) return;
  const newRef = push(ref(db, "users"));
  await set(newRef, {
    name: "Catalina Carranza",
    passwordHash: adminHash,
    role: "admin",
    createdBy: "sistema",
    createdAt: new Date().toISOString(),
  });
}
