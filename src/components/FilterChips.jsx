import { C } from "../constants";

// ─── Filter chips for estado ───
export default function FilterChips({ filtroEstado, setFiltroEstado, stats }) {
  const filterBtn = (key) => ({
    fontSize: 11,
    fontWeight: filtroEstado === key ? 700 : 500,
    padding: "5px 12px",
    borderRadius: 4,
    cursor: "pointer",
    border: "none",
    transition: "all .1s",
    background: filtroEstado === key ? C.navy : C.white,
    color: filtroEstado === key ? C.white : C.g700,
    boxShadow: filtroEstado === key ? "none" : `inset 0 0 0 1px ${C.g200}`,
  });

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1,
          color: C.g500,
          textTransform: "uppercase",
          marginRight: 4,
        }}
      >
        Filtrar:
      </span>
      <button style={filterBtn("TODOS")} onClick={() => setFiltroEstado("TODOS")}>
        Todos ({stats.total})
      </button>
      <button style={filterBtn("CONTABILIZADO")} onClick={() => setFiltroEstado("CONTABILIZADO")}>
        Contabilizado ({stats.contabilizado})
      </button>
      <button style={filterBtn("PENDIENTE")} onClick={() => setFiltroEstado("PENDIENTE")}>
        Pendiente ({stats.pendiente})
      </button>
      <button style={filterBtn("RECHAZADO")} onClick={() => setFiltroEstado("RECHAZADO")}>
        Rechazado ({stats.rechazado})
      </button>
      <button style={filterBtn("SIN ESTADO")} onClick={() => setFiltroEstado("SIN ESTADO")}>
        Sin estado ({stats.sinEstado})
      </button>
      <button style={filterBtn("SIN RESPUESTA")} onClick={() => setFiltroEstado("SIN RESPUESTA")}>
        Sin respuesta ({stats.sinRta})
      </button>
    </div>
  );
}
