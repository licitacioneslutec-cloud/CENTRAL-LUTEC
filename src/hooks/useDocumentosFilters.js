import { useMemo, useState } from "react";
import { parseDateDMY } from "../utils";

// ─── Filter + search state, plus derived stats, for a documentos dataset ───
export function useDocumentosFilters(data) {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const filtered = useMemo(() => {
    let d = data;
    if (filtroEstado === "SIN ESTADO") {
      d = d.filter((r) => !r.estado);
    } else if (filtroEstado !== "TODOS") {
      d = d.filter((r) => r.estado === filtroEstado);
    }
    if (search) {
      const s = search.toLowerCase();
      const has = (v) => v != null && String(v).toLowerCase().includes(s);
      d = d.filter(
        (r) => has(r.nombreEmisor) || has(r.nitEmisor) || has(r.numeroDocumento) || has(r.ordenCompra)
      );
    }
    if (fechaDesde || fechaHasta) {
      const desde = fechaDesde ? new Date(fechaDesde + "T00:00:00") : null;
      const hasta = fechaHasta ? new Date(fechaHasta + "T00:00:00") : null;
      d = d.filter((r) => {
        const fr = parseDateDMY(r.fechaRecepcion);
        if (!fr) return false;
        if (desde && fr < desde) return false;
        if (hasta && fr > hasta) return false;
        return true;
      });
    }
    return d;
  }, [data, search, filtroEstado, fechaDesde, fechaHasta]);

  const stats = useMemo(
    () => ({
      total: data.length,
      enProceso: data.filter((r) => r.estado === "EN PROCESO").length,
      novedad: data.filter((r) => r.estado === "NOVEDAD").length,
      rechazado: data.filter((r) => r.estado === "RECHAZADO").length,
      solucionado: data.filter((r) => r.estado === "SOLUCIONADO").length,
      sinEstado: data.filter((r) => !r.estado).length,
      totalVal: data.reduce((s, r) => s + (r.valorTotal || 0), 0),
    }),
    [data]
  );

  const filteredStats = useMemo(
    () => ({
      count: filtered.length,
      totalVal: filtered.reduce((s, r) => s + (r.valorTotal || 0), 0),
      totalIva: filtered.reduce((s, r) => s + (r.iva || 0), 0),
    }),
    [filtered]
  );

  return {
    filtered,
    search,
    setSearch,
    filtroEstado,
    setFiltroEstado,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    stats,
    filteredStats,
  };
}
