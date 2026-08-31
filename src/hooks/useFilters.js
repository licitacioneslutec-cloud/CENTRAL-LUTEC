import { useMemo, useState } from "react";

// ─── Filter + search state, plus derived stats, for a facturas dataset ───
export function useFilters(data) {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const filtered = useMemo(() => {
    let d = data;
    if (filtroEstado !== "TODOS") {
      d = filtroEstado === "SIN ESTADO" ? d.filter((r) => !r.estado) : d.filter((r) => r.estado === filtroEstado);
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
    return d;
  }, [data, search, filtroEstado]);

  const stats = useMemo(
    () => ({
      total: data.length,
      contabilizado: data.filter((r) => r.estado === "CONTABILIZADO").length,
      pendiente: data.filter((r) => r.estado === "PENDIENTE").length,
      rechazado: data.filter((r) => r.estado === "RECHAZADO").length,
      sinEstado: data.filter((r) => !r.estado).length,
      sinRta: data.filter((r) => !r.rtaCompras).length,
      totalVal: data.reduce((s, r) => s + (r.total || 0), 0),
    }),
    [data]
  );

  return { filtered, search, setSearch, filtroEstado, setFiltroEstado, stats };
}
