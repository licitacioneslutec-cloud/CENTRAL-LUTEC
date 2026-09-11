import { useState } from "react";
import { C } from "../constants";

const CUSTOM = "__custom__";

// Splits an existing nERP value like "OC 27156" into its known prefix + rest,
// given the configured prefix list. Returns null when no prefix matches.
function parsePrefixed(value, prefixes) {
  if (!value) return null;
  const s = String(value);
  const match = prefixes.find((p) => s === p || s.startsWith(p + " "));
  if (!match) return null;
  return { prefix: match, rest: s.slice(match.length).trim() };
}

// ─── Inline-editable table cell (text, select, combo, or prefixed) ───
export default function EditableCell({
  value,
  type = "text",
  options = [],
  prefixes = [],
  canEdit,
  onSave,
  placeholder = "Click para agregar",
  renderValue,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [customMode, setCustomMode] = useState(false);
  const [prefixMode, setPrefixMode] = useState(true);
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [numberPart, setNumberPart] = useState("");

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(value || "");
    setCustomMode(false);
    if (type === "prefixed") {
      const parsed = parsePrefixed(value, prefixes);
      if (parsed) {
        setPrefixMode(true);
        setSelectedPrefix(parsed.prefix);
        setNumberPart(parsed.rest);
      } else {
        setPrefixMode(false);
        setSelectedPrefix(prefixes[0] || "");
        setNumberPart("");
      }
    }
    setEditing(true);
  };

  const save = () => {
    if (type === "prefixed" && prefixMode) {
      onSave(numberPart.trim() ? `${selectedPrefix} ${numberPart.trim()}` : "");
    } else {
      onSave(typeof draft === "string" ? draft.trim() : draft);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  const comboSelect = (v) => {
    if (v === CUSTOM) {
      setCustomMode(true);
      setDraft("");
      return;
    }
    onSave(v);
    setEditing(false);
  };

  if (canEdit && editing) {
    let control;
    if (type === "select") {
      control = (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ fontSize: 11, padding: "2px 4px", border: `1px solid ${C.g200}`, borderRadius: 3 }}
        >
          <option value="">Sin estado</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    } else if (type === "combo" && !customMode && options.length > 0) {
      control = (
        <select
          value=""
          onChange={(e) => comboSelect(e.target.value)}
          autoFocus
          style={{ fontSize: 11, padding: "2px 4px", border: `1px solid ${C.g200}`, borderRadius: 3, maxWidth: 200 }}
        >
          <option value="">— Seleccionar —</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={CUSTOM}>✏️ Escribir...</option>
        </select>
      );
    } else if (type === "prefixed") {
      control = prefixMode ? (
        <>
          <select
            value={selectedPrefix}
            onChange={(e) => setSelectedPrefix(e.target.value)}
            autoFocus
            style={{ fontSize: 11, padding: "2px 4px", border: `1px solid ${C.g200}`, borderRadius: 3 }}
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={numberPart}
            onChange={(e) => setNumberPart(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: 11, padding: "3px 5px", border: `1px solid ${C.g200}`, borderRadius: 3, width: 90 }}
          />
          {prefixes.length > 0 && (
            <button
              type="button"
              onClick={() => { setPrefixMode(false); setDraft(numberPart ? `${selectedPrefix} ${numberPart}` : ""); }}
              title="Texto libre"
              style={{ background: "none", color: C.blue, border: "none", fontSize: 10, cursor: "pointer", padding: 0 }}
            >
              Texto libre
            </button>
          )}
        </>
      ) : (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{ fontSize: 11, padding: "3px 5px", border: `1px solid ${C.g200}`, borderRadius: 3, width: 140 }}
          />
          {prefixes.length > 0 && (
            <button
              type="button"
              onClick={() => setPrefixMode(true)}
              title="Usar prefijo"
              style={{ background: "none", color: C.blue, border: "none", fontSize: 10, cursor: "pointer", padding: 0 }}
            >
              Con prefijo
            </button>
          )}
        </>
      );
    } else {
      // plain text, and combo when in customMode or with no predefined options
      control = (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ fontSize: 11, padding: "3px 5px", border: `1px solid ${C.g200}`, borderRadius: 3, width: 140 }}
        />
      );
    }

    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {control}
        <button
          onClick={save}
          style={{ background: C.accent, color: C.white, border: "none", fontSize: 11, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}
        >
          ✓
        </button>
        <button
          onClick={cancel}
          style={{ background: C.g100, color: C.g700, border: "none", fontSize: 11, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>
    );
  }

  const display = value != null && value !== "" ? String(value) : "";

  return (
    <div onClick={startEdit} style={{ cursor: canEdit ? "pointer" : "default" }} title={display || undefined}>
      {renderValue ? (
        renderValue(value)
      ) : display ? (
        <span style={{ color: C.g700 }}>{display}</span>
      ) : canEdit ? (
        <span style={{ color: C.blue, fontWeight: 500 }}>{placeholder}</span>
      ) : (
        <span style={{ color: C.g300 }}>—</span>
      )}
    </div>
  );
}
