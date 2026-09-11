import { C } from "../constants";

export default function SearchBar({ search, setSearch }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input
        type="text"
        className="search-input"
        placeholder="Buscar folio, emisor, NIT, CUFE, N° ERP..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          fontSize: 12,
          padding: "7px 12px",
          paddingRight: 24,
          border: `1px solid ${C.g200}`,
          borderRadius: 4,
          width: 220,
          outline: "none",
        }}
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.g500,
            fontSize: 14,
            padding: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
