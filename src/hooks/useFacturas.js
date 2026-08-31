import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, initFirebase, subscribeFacturas, writeFactura, updateFactura, toSafeKey } from "../firebase";
import { SAMPLE_NOVEDADES, SAMPLE_NO_RADICADAS } from "../constants";

const SAMPLES = { novedades: SAMPLE_NOVEDADES, noRadicadas: SAMPLE_NO_RADICADAS };

// Converts Firebase's {cufeHash: factura} object into an array, using the hash as `id`.
function toArray(fbData) {
  return fbData ? Object.entries(fbData).map(([id, val]) => ({ ...val, id })) : [];
}

// ─── Facturas data access for one tab ("novedades" | "noRadicadas") ───
// Reads/writes Realtime Database when Firebase is configured; otherwise falls
// back to local state seeded with sample data (dev/offline mode).
export function useFacturas(tab) {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [data, setData] = useState(() => (configured ? [] : SAMPLES[tab]));
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    // Without Firebase, `data` already holds the sample data from useState's
    // initializer above — nothing to subscribe to.
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeFacturas(dbRef.current, tab, (fbData) => {
      setData(toArray(fbData));
      setLoading(false);
    });
  }, [tab, configured]);

  // Updates one field of one record, identified by `id` (the Firebase key, or
  // the sample record's `id` when running without Firebase).
  const updateField = useCallback(
    (id, key, value) => {
      if (configured) {
        updateFactura(dbRef.current, tab, id, { [key]: value });
      } else {
        setData((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
      }
    },
    [tab, configured]
  );

  // Adds one factura, skipping it if its CUFE already exists. Returns true if added.
  const addFactura = useCallback(
    (factura) => {
      if (!factura?.cufe || data.some((r) => r.cufe === factura.cufe)) return false;
      if (configured) {
        writeFactura(dbRef.current, tab, toSafeKey(factura.cufe), factura);
      } else {
        setData((prev) => [...prev, { id: Date.now(), ...factura }]);
      }
      return true;
    },
    [tab, configured, data]
  );

  // Adds multiple facturas, deduplicating by CUFE against existing data and
  // within the batch itself. Returns the count actually added.
  const bulkAdd = useCallback(
    (facturas) => {
      const seen = new Set(data.map((r) => r.cufe));
      const toInsert = [];
      for (const f of facturas) {
        if (!f?.cufe || seen.has(f.cufe)) continue;
        seen.add(f.cufe);
        toInsert.push(f);
      }
      if (toInsert.length === 0) return 0;
      if (configured) {
        toInsert.forEach((f) => writeFactura(dbRef.current, tab, toSafeKey(f.cufe), f));
      } else {
        setData((prev) => [...prev, ...toInsert.map((f, i) => ({ id: Date.now() + i, ...f }))]);
      }
      return toInsert.length;
    },
    [tab, configured, data]
  );

  return { data, loading, updateField, addFactura, bulkAdd };
}
