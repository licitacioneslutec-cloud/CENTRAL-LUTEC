import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { C } from "../constants";
import { masHistorial } from "../contratosFirebase";

const PAGINA = 200;
const sel = { fontSize: 12, padding: "5px 7px", border: `1px solid ${C.g200}`, borderRadius: 4, background: C.white };
const btn = { background: C.white, border: `1px solid ${C.g200}`, fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 4, cursor: "pointer", color: C.navy };
const th = { textAlign: "left", padding: "6px 8px", fontSize: 10, fontWeight: 700, color: C.g500, textTransform: "uppercase", borderBottom: `2px solid ${C.g200}`, position: "sticky", top: 0, background: C.white };
const td = { padding: "5px 8px", fontSize: 12, color: C.g900, borderBottom: `1px solid ${C.g100}`, verticalAlign: "top" };
const dia = (at) => (at ? new Date(at).toLocaleDateString("sv") : ""); // YYYY-MM-DD local
const fmtAt = (at) => (at ? new Date(at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

// Vista de historial (solo admin). recent = últimas 200 entradas en vivo; "Cargar más" trae páginas anteriores con endBefore.
export default function HistorialContratos({ db, recent, onClose }) {
  const [older, setOlder] = useState([]);
  const [fin, setFin] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [f, setF] = useState({ usuario: "", hoja: "", accion: "", desde: "", hasta: "" });

  const todas = useMemo(() => {
    const m = new Map([...recent, ...older].map((h) => [h.id, h]));
    return [...m.values()].sort((a, b) => (a.id < b.id ? 1 : -1));
  }, [recent, older]);
  const opciones = (k) => [...new Set(todas.map((h) => h[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filas = useMemo(() => todas.filter((h) =>
    (!f.usuario || h.usuario === f.usuario) && (!f.hoja || h.hoja === f.hoja) && (!f.accion || h.accion === f.accion)
    && (!f.desde || dia(h.at) >= f.desde) && (!f.hasta || dia(h.at) <= f.hasta)), [todas, f]);

  const cargarMas = async () => {
    setCargando(true);
    try {
      const mas = await masHistorial(db, todas[todas.length - 1].id, PAGINA);
      setOlder((o) => [...o, ...mas]);
      if (mas.length < PAGINA) setFin(true);
    } catch (e) { alert("No se pudo cargar: " + (e.message || e)); }
    setCargando(false);
  };

  const exportar = () => {
    const aoa = [["Fecha", "Usuario", "Acción", "Constructora", "Contrato", "Detalle", "Campo", "Antes", "Después"],
      ...filas.map((h) => [fmtAt(h.at), h.usuario, h.accion, h.hoja, h.contrato, h.detalle, h.campo, h.antes, h.despues].map((v) => v ?? ""))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Historial");
    XLSX.writeFile(wb, `Historial_Contratos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const campo = (k, ph, lista) => (
    <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={sel}>
      <option value="">{ph}</option>{lista.map((x) => <option key={x}>{x}</option>)}
    </select>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1100, padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.white, borderRadius: 8, padding: 20, width: "100%", maxWidth: 1200, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: 15, color: C.navy, margin: "0 0 10px" }}>Historial de cambios</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {campo("usuario", "Todos los usuarios", opciones("usuario"))}
          {campo("hoja", "Todas las constructoras", opciones("hoja"))}
          {campo("accion", "Todas las acciones", opciones("accion"))}
          <label style={{ fontSize: 11, color: C.g500 }}>Desde <input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} style={sel} /></label>
          <label style={{ fontSize: 11, color: C.g500 }}>Hasta <input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} style={sel} /></label>
          <button style={{ ...btn, marginLeft: "auto" }} onClick={exportar} disabled={!filas.length}>Exportar historial (.xlsx)</button>
        </div>
        <div style={{ overflow: "auto", border: `1px solid ${C.g200}`, borderRadius: 4, flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Fecha</th><th style={th}>Usuario</th><th style={th}>Acción</th><th style={th}>Constructora</th><th style={th}>Contrato</th><th style={th}>Detalle</th></tr></thead>
            <tbody>
              {filas.map((h) => (
                <tr key={h.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtAt(h.at)}</td><td style={td}>{h.usuario}</td><td style={td}>{h.accion}</td>
                  <td style={td}>{h.hoja || "—"}</td><td style={td}>{h.contrato || "—"}</td>
                  <td style={td}>{h.detalle}{h.campo ? ` · ${h.campo}: ${h.antes ?? "—"} → ${h.despues ?? "—"}` : ""}</td>
                </tr>
              ))}
              {!filas.length && <tr><td style={{ ...td, color: C.g500 }} colSpan={6}>Sin registros.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: C.g500 }}>{filas.length} de {todas.length} cargados</span>
          {!fin && todas.length >= PAGINA && <button style={btn} onClick={cargarMas} disabled={cargando}>{cargando ? "Cargando…" : "Cargar más"}</button>}
          <button style={{ ...btn, marginLeft: "auto" }} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
