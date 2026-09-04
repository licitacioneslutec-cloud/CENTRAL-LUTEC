import { useMemo, useState } from "react";
import { parseDateDMY } from "../utils";

// ─── Filter + search state, plus derived stats, for a facturas dataset ───
export function useFilters(data) {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const filtered = useMemo(() => {
    let d = data;
    if (filtroEstado === "SIN RESPUESTA") {
      d = d.filter((r) => !r.rtaCompras);
    } else if (filtroEstado === "SIN ESTADO") {
      d = d.filter((r) => !r.estado);
    } else if (filtroEstado === "PENDIENTE REVISIÓN") {
      d = d.filter((r) => r.rtaCompras && r.rtaRevisada === false);
    } else if (filtroEstado !== "TODOS") {
      d = d.filter((r) => r.estado === filtroEstado);
    }
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(
        (r) =>
          r.folio?.toLowerCase().includes(s) ||
          r.nombreEmisor?.toLowerCase().includes(s) ||
          r.cufe?.toLowerCase().includes(s) ||
          r.rtaCompras?.toLowerCase().includes(s) ||
          r.nitEmisor?.includes(s)
      );
    }
    if (fechaDesde || fechaHasta) {
      const desde = fechaDesde ? new Date(fechaDesde + "T00:00:00") : null;
      const hasta = fechaHasta ? new Date(fechaHasta + "T00:00:00") : null;
      d = d.filter((r) => {
        const fe = parseDateDMY(r.fechaEmision);
        if (!fe) return false;
        if (desde && fe < desde) return false;
        if (hasta && fe > hasta) return false;
        return true;
      });
    }
    return d;
  }, [data, search, filtroEstado, fechaDesde, fechaHasta]);

  const stats = useMemo(
    () => ({
      total: data.length,
      contabilizado: data.filter((r) => r.estado === "CONTABILIZADO").length,
      pendiente: data.filter((r) => r.estado === "PENDIENTE").length,
      rechazado: data.filter((r) => r.estado === "RECHAZADO").length,
      noRadicada: data.filter((r) => r.estado === "NO RADICADA").length,
      sinEstado: data.filter((r) => !r.estado).length,
      sinRta: data.filter((r) => !r.rtaCompras).length,
      pendienteRevision: data.filter((r) => r.rtaCompras && r.rtaRevisada === false).length,
      totalVal: data.reduce((s, r) => s + (r.total || 0), 0),
    }),
    [data]
  );

  const filteredStats = useMemo(
    () => ({
      count: filtered.length,
      totalVal: filtered.reduce((s, r) => s + (r.total || 0), 0),
      totalIva: filtered.reduce((s, r) => s + (r.iva || 0), 0),
      totalValContabilizado: filtered.reduce((s, r) => s + (r.valorContabilizado || 0), 0),
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
