import { useRef } from "react";
import { C } from "../constants";
import { parseExcel } from "../utils";

// ─── "Cargar Excel" button + hidden file input. Parses the selected workbook
// and hands the split { novedades, noRadicadas } result to `onUpload`. ───
export default function UploadExcel({ onUpload }) {
  const inputRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const parsed = parseExcel(buffer);
    onUpload(parsed);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleChange} style={{ display: "none" }} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          background: C.accent,
          border: "none",
          color: C.white,
          fontSize: 11,
          fontWeight: 700,
          padding: "7px 14px",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Cargar Excel
      </button>
    </>
  );
}
