import { useState } from "react";
import { C } from "../constants";

export default function SoporteUpload({ docId }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docId", docId);
      formData.append("fileName", file.name);
      const res = await fetch("https://licitaciones3.app.n8n.cloud/webhook/docs-proveedor-upload-ext", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Error al enviar");
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: C.off, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ background: C.white, borderRadius: 8, padding: 32, maxWidth: 420, textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: C.green }}>✓</div>
          <h2 style={{ color: C.navy, fontSize: 18, marginBottom: 8 }}>Soporte Recibido</h2>
          <p style={{ color: C.g500, fontSize: 13 }}>Su documento de soporte ha sido recibido exitosamente. El área de compras revisará la documentación.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.off, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ background: C.white, borderRadius: 8, padding: 32, maxWidth: 420, width: "90%", boxShadow: "0 4px 16px rgba(0,0,0,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${C.accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: C.navy, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 }}>LUTEC</span>
          </div>
          <span style={{ color: C.navy, fontSize: 14, fontWeight: 700 }}>GRUPO LUTEC SAS</span>
        </div>

        <h2 style={{ color: C.navy, fontSize: 16, margin: "0 0 4px" }}>Subir Documento Soporte</h2>
        <p style={{ color: C.g500, fontSize: 12, margin: "0 0 20px" }}>
          Documento ID: <strong>{docId || "—"}</strong>
        </p>

        <div
          style={{
            border: `2px dashed ${file ? C.accent : C.g200}`,
            borderRadius: 6, padding: 24, textAlign: "center",
            marginBottom: 16, cursor: "pointer",
            background: file ? C.greenL : C.off,
          }}
          onClick={() => document.getElementById("soporte-file").click()}
        >
          <input
            id="soporte-file"
            type="file"
            accept=".pdf,.xml,.zip,.jpg,.png"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          {file ? (
            <div>
              <div style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>{file.name}</div>
              <div style={{ color: C.g500, fontSize: 11, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 24, color: C.g300, marginBottom: 6 }}>📄</div>
              <div style={{ color: C.g500, fontSize: 12 }}>Click para seleccionar archivo</div>
              <div style={{ color: C.g300, fontSize: 10, marginTop: 4 }}>PDF, XML, ZIP, JPG, PNG</div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!file || uploading}
          style={{
            width: "100%", padding: "10px 16px", borderRadius: 4, border: "none",
            background: file && !uploading ? C.accent : C.g200,
            color: file && !uploading ? C.white : C.g500,
            fontSize: 13, fontWeight: 700,
            cursor: file && !uploading ? "pointer" : "not-allowed",
          }}
        >
          {uploading ? "Enviando…" : "Enviar Soporte"}
        </button>

        {error && <p style={{ color: C.red, fontSize: 12, textAlign: "center", margin: "12px 0 0" }}>{error}</p>}

        <p style={{ color: C.g300, fontSize: 10, textAlign: "center", margin: "16px 0 0" }}>
          GRUPO LUTEC SAS — Portal de Documentos
        </p>
      </div>
    </div>
  );
}
