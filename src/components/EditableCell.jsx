import { useState } from "react";
import { C } from "../constants";

// ─── Inline-editable table cell (text or select) ───
export default function EditableCell({
  value,
  type = "text",
  options = [],
  canEdit,
  onSave,
  placeholder = "Click para agregar",
  renderValue,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(value || "");
    setEditing(true);
  };

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (canEdit && editing) {
    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {type === "select" ? (
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ fontSize: 10, padding: "2px 4px", border: `1px solid ${C.g200}`, borderRadius: 3 }}
          >
            <option value="">Sin estado</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ fontSize: 11, padding: "3px 5px", border: `1px solid ${C.g200}`, borderRadius: 3, width: 140 }}
          />
        )}
        <button
          onClick={save}
          style={{ background: C.accent, color: C.white, border: "none", fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}
        >
          ✓
        </button>
        <button
          onClick={cancel}
          style={{ background: C.g100, color: C.g700, border: "none", fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div onClick={startEdit} style={{ cursor: canEdit ? "pointer" : "default" }} title={value || undefined}>
      {renderValue ? (
        renderValue(value)
      ) : value ? (
        <span style={{ color: C.g700 }}>{value}</span>
      ) : canEdit ? (
        <span style={{ color: C.blue, fontWeight: 500 }}>{placeholder}</span>
      ) : (
        <span style={{ color: C.g300 }}>—</span>
      )}
    </div>
  );
}
