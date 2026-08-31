import { useState } from "react";
import { DEPARTMENTS, C } from "../constants";
import PasswordGate from "./PasswordGate";

// ─── Portal Landing ───
export default function Portal({ onNavigate }) {
  const [pendingExternal, setPendingExternal] = useState(null);

  return (
    <div style={{ minHeight:"100vh", background:C.off, fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <header className="app-header" style={{ background:C.navy, padding:"16px 32px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:42, height:42, border:`2px solid ${C.accent}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:C.white, fontSize:11, fontWeight:700, letterSpacing:1.5 }}>LUTEC</span>
        </div>
        <div>
          <div style={{ color:C.accent, fontSize:11, fontWeight:600, letterSpacing:2.5, textTransform:"uppercase" }}>Grupo Lutec S.A.S</div>
          <div className="brand-title" style={{ color:C.white, fontSize:20, fontWeight:700 }}>PORTAL CORPORATIVO</div>
        </div>
      </header>

      <div style={{ maxWidth:1060, margin:"0 auto", padding:"48px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ color:C.accent, fontSize:11, fontWeight:600, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>Plataforma centralizada</div>
          <h1 style={{ fontSize:26, fontWeight:700, color:C.navy, margin:0 }}>Herramientas por Área</h1>
          <p style={{ color:C.g500, fontSize:13, marginTop:6 }}>Seleccione un módulo para acceder. Los enlaces externos abren en nueva pestaña.</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
          {DEPARTMENTS.map((dept) => (
            <div key={dept.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:8, borderBottom:`2px solid ${C.g200}` }}>
                <span style={{ fontSize:22 }}>{dept.icon}</span>
                <div>
                  <h2 style={{ fontSize:16, fontWeight:700, color:C.navy, margin:0, textTransform:"uppercase", letterSpacing:1 }}>{dept.name}</h2>
                  <p style={{ fontSize:12, color:C.g500, margin:0 }}>{dept.desc}</p>
                </div>
              </div>
              <div className="module-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10, paddingLeft:32 }}>
                {dept.modules.map((mod) => {
                  const isExt = mod.type === "external";
                  const isSoon = mod.status === "proximamente";
                  return (
                    <button
                      key={mod.id + dept.id}
                      onClick={() => {
                        if (isSoon) return;
                        if (isExt) {
                          if (mod.password && !sessionStorage.getItem('auth_' + mod.id)) {
                            setPendingExternal(mod);
                            return;
                          }
                          window.open(mod.url, '_blank');
                        }
                        else onNavigate("facturas", mod.role, mod.password);
                      }}
                      disabled={isSoon}
                      style={{
                        background:C.white, border:`1px solid ${C.g200}`, borderRadius:6, padding:"16px 18px",
                        cursor:isSoon?"default":"pointer", textAlign:"left", opacity:isSoon?.5:1,
                        transition:"all .15s", boxShadow:"0 1px 2px rgba(0,0,0,.04)", display:"flex", alignItems:"center", justifyContent:"space-between",
                      }}
                      onMouseEnter={e=>{ if(!isSoon) e.currentTarget.style.borderColor=C.accent; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.g200; }}
                    >
                      <div style={{ flex:1 }}>
                        <h3 style={{ fontSize:13, fontWeight:700, color:C.navy, margin:"0 0 3px" }}>{mod.name}</h3>
                        <p style={{ fontSize:11, color:C.g500, margin:0, lineHeight:1.4 }}>{mod.desc}</p>
                      </div>
                      {isSoon ? (
                        <span style={{ fontSize:11, fontWeight:600, letterSpacing:1, color:C.g300, textTransform:"uppercase", padding:"4px 10px", border:`1px solid ${C.g200}`, borderRadius:3, whiteSpace:"nowrap", marginLeft:12 }}>Próximamente</span>
                      ) : isExt ? (
                        <span style={{ fontSize:16, color:C.g300, marginLeft:12 }} title="Abre en nueva pestaña">↗</span>
                      ) : (
                        <span style={{ background:C.navy, color:C.white, fontSize:11, fontWeight:700, letterSpacing:.5, padding:"5px 12px", borderRadius:3, textTransform:"uppercase", whiteSpace:"nowrap", marginLeft:12 }}>Abrir</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:40, background:C.white, border:`1px solid ${C.g200}`, borderRadius:8, padding:"16px 20px" }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, color:C.accent, textTransform:"uppercase", marginBottom:6 }}>Sobre los enlaces externos</div>
          <p style={{ fontSize:12, color:C.g500, margin:0, lineHeight:1.6 }}>
            Los módulos marcados con ↗ abren sus aplicaciones en una nueva pestaña. Cada uno tiene su propio repositorio en GitHub y se publica a través de Netlify. Los módulos internos funcionan dentro de este portal con datos compartidos en Firebase.
          </p>
        </div>
      </div>

      {pendingExternal && (
        <PasswordGate
          moduleId={pendingExternal.id}
          role={pendingExternal.id}
          passwordHash={pendingExternal.password}
          onSuccess={() => {
            sessionStorage.setItem('auth_' + pendingExternal.id, '1');
            window.open(pendingExternal.url, '_blank');
            setPendingExternal(null);
          }}
          onCancel={() => setPendingExternal(null)}
        />
      )}
    </div>
  );
}
