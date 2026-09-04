import { useState } from "react";
import { C } from "../constants";
import { hashPassword } from "./PasswordGate";
import { initFirebase, getUsers } from "../firebase";

// ─── Login screen for the corporate portal ───
export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username || !password || checking) return;
    setChecking(true);
    setError("");
    try {
      const users = await getUsers(initFirebase());
      const entry = Object.entries(users || {}).find(
        ([, u]) => u.name?.toLowerCase() === username.toLowerCase()
      );
      if (!entry) {
        setError("Usuario no encontrado");
        return;
      }
      const [id, user] = entry;
      const hash = await hashPassword(password);
      if (hash !== user.passwordHash) {
        setError("Contraseña incorrecta");
        setPassword("");
        return;
      }
      onLogin({ id, name: user.name, role: user.role });
    } catch {
      setError("No se pudo validar el acceso");
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
              Portal Corporativo LUTEC
            </div>
            <div style={{ color: C.navy, fontSize: 14, fontWeight: 700 }}>Iniciar Sesión</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="login-username-input"
            style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.g700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Usuario
          </label>
          <input
            id="login-username-input"
            type="text"
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ingrese su usuario"
            style={{
              width: "100%", boxSizing: "border-box", padding: "9px 10px", fontSize: 13,
              border: `1px solid ${C.g200}`, borderRadius: 5, outline: "none",
              marginBottom: 14, fontFamily: "inherit",
            }}
          />

          <label
            htmlFor="login-password-input"
            style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.g700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Contraseña
          </label>
          <input
            id="login-password-input"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="Ingrese su contraseña"
            style={{
              width: "100%", boxSizing: "border-box", padding: "9px 10px", fontSize: 13,
              border: `1px solid ${error ? C.red : C.g200}`, borderRadius: 5, outline: "none",
              marginBottom: error ? 6 : 18, fontFamily: "inherit",
            }}
          />
          {error && (
            <div style={{ color: C.red, fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={checking || !username || !password}
            style={{
              width: "100%", padding: "9px 0", fontSize: 12, fontWeight: 700, borderRadius: 5,
              border: "none", background: C.accent, color: C.white,
              cursor: checking || !username || !password ? "default" : "pointer",
              opacity: checking || !username || !password ? 0.6 : 1,
            }}
          >
            {checking ? "Validando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
