# Portal Corporativo LUTEC

## Stack
- React 19 + Vite 8, deployed on Netlify
- Firebase Realtime Database (no auth layer, env-configured)
- xlsx library for Excel import/export

## Architecture
- `src/App.jsx` — router + password gate
- `src/components/FacturasModule.jsx` — main facturas view (search, filters, stats, table, upload)
- `src/components/FacturasTable.jsx` — data table with expandable detail rows
- `src/hooks/useFacturas.js` — Firebase CRUD, falls back to sample data without config
- `src/hooks/useFilters.js` — text search, estado filter, date range filter, stats
- `src/firebase.js` — Firebase init and helpers
- `src/constants.js` — departments, field definitions, estados, color palette
- `src/utils.js` — currency formatting, date parsing, Excel export/import

## Roles
Two roles access the facturas module with separate passwords (SHA-256 hashed in constants.js):
- **contabilidad** — uploads facturas, sets estado/observacion, replies via rtaContabilidad
- **compras** — responds via rtaCompras

## Key patterns
- Dates stored as "DD-MM-YYYY", parsed with `parseDateDMY()` (local time). Date inputs produce "YYYY-MM-DD" — always append `"T00:00:00"` when constructing Date objects from input values to avoid UTC/local mismatch.
- User identity stored in `localStorage("lutec_username")`, prompted once per browser. Edits stamp `lastEditedBy`, `lastEditedAt`, `lastEditedField` on each Firebase update.
- `rtaRevisada` flag: set to `false` when compras writes `rtaCompras`, set to `true` when contabilidad writes `rtaContabilidad` or clicks the review checkmark.
- Stats: `stats` computes from full dataset (for filter chip counts), `filteredStats` computes from filtered data (for monetary totals display).

## Dev
```bash
npm run dev    # Vite dev server on port 5173
npm run build  # production build
```

Without Firebase env vars, the app uses sample data from `constants.js`.
