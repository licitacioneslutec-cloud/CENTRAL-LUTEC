import { useState } from "react";
import { ALL_FIELDS, C } from "../constants";

// Fields set by their respective roles during review, not during manual creation.
const EXCLUDED_KEYS = ["estado", "rtaCompras"];
const FORM_FIELDS = ALL_FIELDS.filter((f) => !EXCLUDED_KEYS.includes(f.key));

const DEFAULTS = {
  tipoDoc: "Factura electrónica",
  divisa: "COP",
  nitReceptor: "900491816",
  nombreReceptor: "GRUPO LUTEC SAS",
};

const label = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5,
  color: C.g500,
  textTransform: "uppercase",
  marginBottom: 3,
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${C.g200}`,
  borderRadius: 4,
  padding: "6px 8px",
  fontSize: 12,
  color: C.g900,
  fontFamily: "inherit",
};

// ─── Manual factura entry form (Contabilidad only): a grid of inputs for
// every ALL_FIELDS column except the ones owned by review roles. ───
export default function AddRowForm({ onAdd, onCancel }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    FORM_FIELDS.forEach((f) => {
      initial[f.key] = DEFAULTS[f.key] ?? "";
    });
    return initial;
  });

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onAdd({ ...values });
  };

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.g200}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Agregar factura manualmente</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
        }}
      >
        {FORM_FIELDS.map((f) => (
          <div key={f.key}>
            <label style={label}>{f.label}</label>
            <input
              style={input}
              value={values[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={handleSubmit}
          style={{
            background: C.accent,
            border: "none",
            color: C.white,
            fontSize: 11,
            fontWeight: 700,
            padding: "7px 16px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Guardar
        </button>
        <button
          onClick={onCancel}
          style={{
            background: C.g100,
            border: "none",
            color: C.g700,
            fontSize: 11,
            fontWeight: 600,
            padding: "7px 16px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
