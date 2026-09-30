import { useState, useEffect, useCallback, useRef } from "react";
import {
  isFirebaseConfigured,
  initFirebase,
  subscribeFacturas,
  writeFactura,
  updateFactura,
  removeFactura,
  removeAllFacturas,
  toSafeKey,
  consolidateFacturas,
  restoreFromConsolidado,
} from "../firebase";
import { SAMPLE_FACTURAS, ESTADOS_COMPRAS_ALERTA } from "../constants";
import { parseDateDMY } from "../utils";

// Converts Firebase's {cufeHash: factura} object into an array, using the hash as `id`.
function toArray(fbData) {
  return fbData ? Object.entries(fbData).map(([id, val]) => ({ ...val, id })) : [];
}

// ─── Facturas data access ───
// Reads/writes the single `facturas` collection in Realtime Database when
// Firebase is configured; otherwise falls back to local state seeded with
// sample data (dev/offline mode).
export function useFacturas() {
  const configured = isFirebaseConfigured();
  const dbRef = useRef(null);
  const [data, setData] = useState(() => (configured ? [] : SAMPLE_FACTURAS));
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    // Without Firebase, `data` already holds the sample data from useState's
    // initializer above — nothing to subscribe to.
    if (!configured) return;
    if (!dbRef.current) dbRef.current = initFirebase();
    return subscribeFacturas(dbRef.current, (fbData) => {
      setData(toArray(fbData));
      setLoading(false);
    });
  }, [configured]);

  // Updates one field of one record, identified by `id` (the Firebase key, or
  // the sample record's `id` when running without Firebase). Answering
  // rtaCompras (compras role) flags the row as unreviewed for contabilidad.
  const updateField = useCallback(
    (id, key, value, username, role) => {
      const fields = { [key]: value };
      if (username) {
        fields.lastEditedBy = username;
        fields.lastEditedAt = new Date().toISOString();
        fields.lastEditedField = key;
        const suffix = role === "compras" ? "Compras" : "Cont";
        fields[`lastEditedBy${suffix}`] = username;
        fields[`lastEditedAt${suffix}`] = fields.lastEditedAt;
      }
      if (key === "estado") fields.estadoModifiedAt = new Date().toISOString();
      if (key === "estadoCompras") {
        fields.estadoComprasRevisado = !ESTADOS_COMPRAS_ALERTA.includes(value);
      }
      if (key === "rtaCompras" && value) fields.rtaRevisada = false;
      if (key === "rtaContabilidad" && value) {
        fields.rtaRevisada = true;
        fields.rtaContRevisada = false;
      }
      if (key === "rtaContRevisada") { /* explicit mark */ }
      if (configured) {
        updateFactura(dbRef.current, id, fields);
      } else {
        setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)));
      }
    },
    [configured]
  );

  // Adds one factura, skipping it if its CUFE already exists. Returns true if added.
  const addFactura = useCallback(
    (factura) => {
      if (!factura?.cufe || data.some((r) => r.cufe === factura.cufe)) return false;
      if (configured) {
        writeFactura(dbRef.current, toSafeKey(factura.cufe), factura);
      } else {
        setData((prev) => [...prev, { id: Date.now(), ...factura }]);
      }
      return true;
    },
    [configured, data]
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
        toInsert.forEach((f) => writeFactura(dbRef.current, toSafeKey(f.cufe), f));
      } else {
        setData((prev) => [...prev, ...toInsert.map((f, i) => ({ id: Date.now() + i, ...f }))]);
      }
      return toInsert.length;
    },
    [configured, data]
  );

  // Deletes one factura by id.
  const deleteFactura = useCallback(
    (id) => {
      if (configured) {
        removeFactura(dbRef.current, id);
      } else {
        setData((prev) => prev.filter((r) => r.id !== id));
      }
    },
    [configured]
  );

  // Deletes every factura.
  const deleteAll = useCallback(() => {
    if (configured) {
      removeAllFacturas(dbRef.current);
    } else {
      setData([]);
    }
  }, [configured]);

  // Archives facturas whose fechaEmision falls within [fechaDesde, fechaHasta]
  // into consolidados/, removing them from facturas/. Returns the count archived.
  const consolidate = useCallback(
    (nombre, fechaDesde, fechaHasta, username) => {
      const desde = new Date(fechaDesde + "T00:00:00");
      const hasta = new Date(fechaHasta + "T23:59:59");
      const matching = data.filter((r) => {
        const fe = parseDateDMY(r.fechaEmision);
        return fe && fe >= desde && fe <= hasta;
      });
      if (matching.length === 0) return 0;

      const facturas = {};
      const cufeKeys = [];
      for (const r of matching) {
        facturas[r.id] = { ...r };
        delete facturas[r.id].id; // id is the Firebase key, not a data field
        cufeKeys.push(r.id);
      }

      const consolidadoData = {
        nombre,
        fechaDesde,
        fechaHasta,
        creadoPor: username,
        creadoEn: new Date().toISOString(),
        cantidadFacturas: matching.length,
        totalValor: matching.reduce((s, r) => s + (r.total || 0), 0),
        facturas,
      };

      if (configured) {
        consolidateFacturas(dbRef.current, consolidadoData, cufeKeys);
      }
      return matching.length;
    },
    [configured, data]
  );

  return { data, loading, updateField, addFactura, bulkAdd, deleteFactura, deleteAll, consolidate };
}
