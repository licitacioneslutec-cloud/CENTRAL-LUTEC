import { C } from "../constants";

// ─── Search input ───
export default function SearchBar({ search, setSearch }) {
  return (
    <input
      type="text"
      className="search-input"
      placeholder="Buscar folio, emisor, NIT, CUFE..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      style={{
        fontSize: 12,
        padding: "7px 12px",
        border: `1px solid ${C.g200}`,
        borderRadius: 4,
        width: 220,
        outline: "none",
      }}
    />
  );
}
