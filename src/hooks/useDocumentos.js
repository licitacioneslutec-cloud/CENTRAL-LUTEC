import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, initFirebase } from "../firebase";
import {
  subscribeDocumentos,
  addDocumento,
  updateDocumento,
  removeDocumento,
  removeAllDocumentos,
} from "../documentosFirebase";
import { SAMPLE_DOCUMENTOS } from "../documentosConstants";

// Converts Firebase's {id: documento} object into an array, using the key as `id`.
function toArray(fbData) {
  return fbData ? Object.entries(fbData).map(([id, val]) => ({ ...val, id })) : [];
}

// ─── Documentos Proveedor data access ───
// Reads/writes the `documentosProveedor` collection in Realtime Database
// when Firebase is configured; otherwise falls back to local state seeded
// with sample data (dev/offline mode).
export function useDocumentos() {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [data, setData] = useState(() => (configured ? [] : SAMPLE_DOCUMENTOS));
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeDocumentos(dbRef.current, (fbData) => {
      setData(toArray(fbData));
      setLoading(false);
    });
  }, [configured]);

  // Updates one field of one record, identified by `id`.
  const updateField = useCallback(
    (id, key, value, username) => {
      const fields = { [key]: value };
      if (username) {
        fields.lastEditedBy = username;
        fields.lastEditedAt = new Date().toISOString();
        fields.lastEditedField = key;
      }
      if (configured) {
        updateDocumento(dbRef.current, id, fields);
      } else {
        setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
      }
    },
    [configured]
  );

  // Adds one documento with an auto-generated id.
  const addDocumentoRecord = useCallback(
    (documento) => {
      if (configured) {
        addDocumento(dbRef.current, documento);
      } else {
        setData((prev) => [...prev, { id: Date.now(), ...documento }]);
      }
    },
    [configured]
  );

  // Deletes one documento by id.
  const deleteDocumento = useCallback(
    (id) => {
      if (configured) {
        removeDocumento(dbRef.current, id);
      } else {
        setData((prev) => prev.filter((r) => r.id !== id));
      }
    },
    [configured]
  );

  // Deletes every documento.
  const deleteAll = useCallback(() => {
    if (configured) {
      removeAllDocumentos(dbRef.current);
    } else {
      setData([]);
    }
  }, [configured]);

  return { data, loading, updateField, addDocumento: addDocumentoRecord, deleteDocumento, deleteAll };
}
