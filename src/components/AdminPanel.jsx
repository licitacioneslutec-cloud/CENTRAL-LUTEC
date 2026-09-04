import { useState, useEffect, useRef } from "react";
import { C } from "../constants";
import { hashPassword } from "./PasswordGate";
import { initFirebase, subscribeUsers, createUser, deleteUser, updateUser } from "../firebase";

const input = { fontSize: 12, padding: "8px 10px", border: `1px solid ${C.g200}`, borderRadius: 4, outline: "none", width: "100%" };
const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,.04)", padding: 16 };
const th = { padding: "8px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: C.g500, textTransform: "uppercase", borderBottom: `2px solid ${C.g200}` };
const td = { padding: "8px", fontSize: 12, color: C.g700, borderBottom: `1px solid ${C.g100}` };

// ─── Admin panel: create/delete portal users ───
export default function AdminPanel({ user, onBack }) {
  const dbRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("contabilidad");
  const [toast, setToast] = useState(null);
  const [editingPw, setEditingPw] = useState(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    dbRef.current = initFirebase();
    return subscribeUsers(dbRef.current, (data) => {
      setUsers(data ? Object.entries(data).map(([id, val]) => ({ ...val, id })) : []);
    });
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;
    const passwordHash = await hashPassword(password);
    await createUser(dbRef.current, {
      name: name.trim(),
      passwordHash,
      role,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    });
    setName("");
    setPassword("");
    showToast("Usuario creado correctamente.");
  };

  const handleDelete = async (id) => {
    await deleteUser(dbRef.current, id);
    showToast("Usuario eliminado.");
  };

  const handleChangePw = async (id) => {
    if (!newPw.trim()) return;
    const passwordHash = await hashPassword(newPw);
    await updateUser(dbRef.current, id, { passwordHash });
    setEditingPw(null);
    setNewPw("");
    showToast("Contraseña actualizada.");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.off, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <header style={{ background: C.navy, padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.white, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
            </div>
            <span style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>Gestión de Usuarios</span>
            <div style={{ background: C.accent, color: C.navy, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase" }}>ADMIN</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px" }}>
        <form onSubmit={handleCreate} style={{ ...card, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: 11, color: C.g500, display: "block", marginBottom: 4 }}>Nombre completo</label>
            <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ fontSize: 11, color: C.g500, display: "block", marginBottom: 4 }}>Contraseña</label>
            <input type="password" style={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <label style={{ fontSize: 11, color: C.g500, display: "block", marginBottom: 4 }}>Rol</label>
            <select style={input} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="contabilidad">contabilidad</option>
              <option value="compras">compras</option>
            </select>
          </div>
          <button type="submit" style={{ background: C.accent, color: C.navy, border: "none", fontWeight: 700, fontSize: 12, padding: "9px 16px", borderRadius: 4, cursor: "pointer" }}>
            Crear Usuario
          </button>
        </form>

        <div style={card}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Rol</th>
                <th style={th}>Creado por</th>
                <th style={th}>Fecha</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={td}>{u.name}</td>
                  <td style={td}>
                    <span style={{ background: C.g100, color: C.g700, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase" }}>{u.role}</span>
                  </td>
                  <td style={td}>{u.createdBy}</td>
                  <td style={td}>{u.createdAt ? new Date(u.createdAt).toLocaleString("es-CO") : ""}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {editingPw === u.id ? (
                      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="password"
                          placeholder="Nueva contraseña"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          autoFocus
                          style={{ fontSize: 11, padding: "3px 6px", border: `1px solid ${C.g200}`, borderRadius: 3, width: 120 }}
                        />
                        <button onClick={() => handleChangePw(u.id)} style={{ background: C.accent, color: C.navy, border: "none", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>OK</button>
                        <button onClick={() => { setEditingPw(null); setNewPw(""); }} style={{ background: C.g100, color: C.g700, border: "none", fontSize: 11, padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>X</button>
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingPw(u.id); setNewPw(""); }}
                          title="Cambiar contraseña"
                          style={{ background: "none", color: C.blue, border: "none", fontSize: 13, cursor: "pointer", padding: "2px 6px" }}
                        >
                          🔑
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            style={{ background: "none", color: C.red, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "2px 6px" }}
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.navy, color: C.white, fontSize: 13, padding: "10px 20px",
          borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 200,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
