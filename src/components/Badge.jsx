import { C } from "../constants";

// ─── StatusBadge ───
export default function Badge({ estado }) {
  const m = {
    CONTABILIZADO: { bg: C.greenL, c: C.green, b: "#bbf7d0" },
    PENDIENTE: { bg: C.orangeL, c: C.orange, b: "#fde68a" },
    RECHAZADO: { bg: C.redL, c: C.red, b: "#fecaca" },
  };
  const s = m[estado] || { bg: C.g100, c: C.g500, b: C.g200 };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        padding: "3px 8px",
        borderRadius: 3,
        background: s.bg,
        color: s.c,
        border: `1px solid ${s.b}`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {estado || "SIN ESTADO"}
    </span>
  );
}
