import { useState } from "react";
import { C } from "../constants";

// ─── SHA-256 hex digest helper (browser-native, no dependencies) ───
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Password gate modal for protected internal modules ───
export default function PasswordGate({ moduleId, role, passwordHash, onSuccess, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError("");
    try {
      const hash = await hashPassword(password);
      if (hash === passwordHash) {
        onSuccess();
      } else {
        setError("Contraseña incorrecta");
        setPassword("");
      }
    } catch {
      setError("No se pudo validar la contraseña");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(26,39,64,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, fontFamily: "system-ui,-apple-system,sans-serif", padding: 16,
      }}
    >
      <div
        style={{
          background: C.white, borderRadius: 8, padding: "32px 28px", width: 340,
          maxWidth: "100%", boxShadow: "0 10px 40px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 36, height: 36, border: `2px solid ${C.accent}`, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center", background: C.navy, flexShrink: 0,
            }}
          >
            <span style={{ color: C.white, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>LUTEC</span>
          </div>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Acceso restringido
            </div>
            <div style={{ color: C.navy, fontSize: 14, fontWeight: 700 }}>Módulo protegido</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="password-gate-input"
            style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.g700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Contraseña
          </label>
          <input
            id="password-gate-input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ingrese la contraseña"
            style={{
              width: "100%", boxSizing: "border-box", padding: "9px 10px", fontSize: 13,
              border: `1px solid ${error ? C.red : C.g200}`, borderRadius: 5, outline: "none",
              marginBottom: error ? 6 : 18, fontFamily: "inherit",
            }}
          />
          {error && (
            <div style={{ color: C.red, fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 600, borderRadius: 5,
                border: `1px solid ${C.g300}`, background: C.white, color: C.g700, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={checking || !password}
              style={{
                flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 700, borderRadius: 5,
                border: "none", background: C.accent, color: C.white,
                cursor: checking || !password ? "default" : "pointer",
                opacity: checking || !password ? 0.6 : 1,
              }}
            >
              {checking ? "Validando..." : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
