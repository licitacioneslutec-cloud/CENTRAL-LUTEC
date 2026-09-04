# Portal Corporativo LUTEC

## Stack
- React 19 + Vite 8, deployed on Netlify
- Firebase Realtime Database (no auth layer, env-configured)
- xlsx library for Excel import/export

## Architecture
- `src/App.jsx` — router + login gate, seeds admin on first run
- `src/components/LoginScreen.jsx` — login form (user/password against RTDB `/users`)
- `src/components/AdminPanel.jsx` — user CRUD for admin role (Catalina Carranza)
- `src/components/Portal.jsx` — landing page, modules filtered by user role
- `src/components/FacturasModule.jsx` — main facturas view (search, filters, stats, table, upload)
- `src/components/FacturasTable.jsx` — data table with expandable detail rows
- `src/components/PasswordGate.jsx` — password modal for external modules + `hashPassword` helper
- `src/hooks/useFacturas.js` — Firebase CRUD, falls back to sample data without config
- `src/hooks/useFilters.js` — text search, estado filter, date range filter, stats
- `src/firebase.js` — Firebase init, facturas helpers, user helpers (subscribeUsers, createUser, deleteUser, seedAdmin)
- `src/constants.js` — departments, field definitions, estados, color palette
- `src/utils.js` — currency formatting, date parsing, Excel export/import

## Authentication
- Users stored in RTDB `/users/{pushId}` with `{ name, passwordHash (SHA-256), role, createdBy, createdAt }`
- Three roles: `admin` (sees all modules + manages users), `contabilidad`, `compras`
- Admin bootstrap: on first run, if `/users` is empty, creates "Catalina Carranza" with default password `lutec2026`
- Session stored in `sessionStorage("lutec_session")` as JSON `{ id, name, role }` — closing tab = logout
- Admin in facturas module operates as contabilidad role
- External modules keep their own shared passwords (PasswordGate)

## Key patterns
- Dates stored as "DD-MM-YYYY", parsed with `parseDateDMY()` (local time). Date inputs produce "YYYY-MM-DD" — always append `"T00:00:00"` when constructing Date objects from input values to avoid UTC/local mismatch.
- User identity comes from login session (`user.name`). Edits stamp `lastEditedBy`, `lastEditedAt`, `lastEditedField` on each Firebase update.
- `rtaRevisada` flag: set to `false` when compras writes `rtaCompras`, set to `true` when contabilidad writes `rtaContabilidad` or clicks the review checkmark.
- `rtaContRevisada` flag: set to `false` when contabilidad writes `rtaContabilidad`, set to `true` when compras clicks the blue review checkmark. Mirrors `rtaRevisada` in the opposite direction.
- Notifications: bell icon in header shows pending review count per role. `playBeep()` fires once on load when pendingCount > 0.
- Stats: `stats` computes from full dataset (for filter chip counts), `filteredStats` computes from filtered data (for monetary totals display).

## Dev
```bash
npm run dev    # Vite dev server on port 5173
npm run build  # production build
```

Without Firebase env vars, the app uses sample data from `constants.js`.
