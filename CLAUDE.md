# Portal Corporativo LUTEC

## Stack
- React 19 + Vite 8, deployed on Netlify
- Firebase Realtime Database (no auth layer, env-configured)
- xlsx library for Excel import/export
- n8n webhooks for external integrations (correos rechazo)

## Architecture
- `src/App.jsx` — router + login gate, seeds admin on first run
- `src/components/LoginScreen.jsx` — login form (user/password against RTDB `/users`)
- `src/components/AdminPanel.jsx` — user CRUD for admin role
- `src/components/Portal.jsx` — landing page, modules filtered by user role
- `src/components/FacturasModule.jsx` — main facturas view (search, filters, stats, table, upload, notifications bell)
- `src/components/FacturasTable.jsx` — data table with sortable columns and expandable detail rows
- `src/components/SearchBar.jsx` — search input with X clear button
- `src/components/FilterChips.jsx` — estado filter chips (Todos, Contabilizado, Pendiente, Rechazado, No Radicada, Anulado, Sin Estado, Pendiente Revisión)
- `src/components/StatsBar.jsx` — summary stats for filtered data
- `src/components/EditableCell.jsx` — inline editing, supports types: `text`, `select`, `combo`, `prefixed`
- `src/components/AddRowForm.jsx` — manual factura entry form
- `src/components/UploadExcel.jsx` — bulk Excel import
- `src/components/Badge.jsx` — review status badges
- `src/components/DocumentosModule.jsx` — módulo Documentos Proveedor (compras role, n8n integration)
- `src/components/DocumentosTable.jsx` — table for documentos proveedor
- `src/components/SoporteUpload.jsx` — soporte file upload component
- `src/components/PasswordGate.jsx` — password modal for external modules + `hashPassword` helper
- `src/hooks/useFacturas.js` — Firebase CRUD for facturas, falls back to sample data without config
- `src/hooks/useFilters.js` — text search, estado filter, date range filter, stats
- `src/hooks/useDocumentos.js` — Firebase CRUD for documentos proveedor
- `src/hooks/useDocumentosFilters.js` — filters for documentos module
- `src/firebase.js` — Firebase init, facturas/users/config helpers (predefinedResponses, erpPrefixes)
- `src/constants.js` — departments, field definitions (`ALL_FIELDS`), estados, color palette, ERP prefixes
- `src/utils.js` — currency formatting, date parsing, Excel export/import

## Authentication
- Users stored in RTDB `/users/{pushId}` with `{ name, passwordHash (SHA-256), role, createdBy, createdAt }`
- Three roles: `admin` (sees all modules + manages users), `contabilidad`, `compras`
- Admin bootstrap: on first run, if `/users` is empty, seeds "Catalina Carranza" and "Marco Torres" as admins with default password `lutec2026`
- Session stored in `sessionStorage("lutec_session")` as JSON `{ id, name, role }` — closing tab = logout
- Admin in facturas module operates as contabilidad role (`isCont = true`)
- External modules keep their own shared passwords (PasswordGate)

## Key patterns

### Field editability
- Controlled via `editable` property in `ALL_FIELDS` (constants.js). Only 6 fields are editable: `nERP` (prefixed), `valorContabilizado` (contabilidad), `estado` (contabilidad), `observacion` (select-only, contabilidad), `rtaCompras` (text-only, compras), `rtaContabilidad` (text-only, contabilidad)
- `canEditField()` checks role + `editable` metadata; removing `editable` blocks editing in both table and detail view
- `valorContabilizado` mismatch tolerance: flags difference only when `> $1000` vs `total`

### Dates
- Stored as "DD-MM-YYYY", parsed with `parseDateDMY()` (local time). Date inputs produce "YYYY-MM-DD" — always append `"T00:00:00"` when constructing Date objects.

### Edit tracking
- User identity comes from login session (`user.name`). Edits stamp `lastEditedBy`, `lastEditedAt`, `lastEditedField` on each Firebase update.
- Role-specific stamps: `lastEditedByCompras`/`lastEditedAtCompras` or `lastEditedByCont`/`lastEditedAtCont`
- `estadoModifiedAt` — ISO timestamp set when `estado` changes, exported formatted as DD-MM-YYYY HH:MM in Excel backup

### Review flags
- `rtaRevisada`: `false` when compras writes `rtaCompras`, `true` when contabilidad writes `rtaContabilidad` or clicks review checkmark
- `rtaContRevisada`: `false` when contabilidad writes `rtaContabilidad`, `true` when compras clicks blue review checkmark. Mirrors `rtaRevisada` in opposite direction.
- `estadoComprasRevisado`: `false` when `estadoCompras` is set to an alert value (`ESTADOS_COMPRAS_ALERTA`), `true` otherwise

### Notifications (FacturasModule.jsx lines 160–168, 227–262)
- Bell icon 🔔 in facturas header shows `pendingCount` badge
- **Contabilidad** sees: count of rows where `(rtaCompras && rtaRevisada === false) || (estadoCompras in ALERTA && estadoComprasRevisado === false)`
- **Compras** sees: count of rows where `rtaContabilidad && rtaContRevisada === false`
- `playBeep()` fires once on initial load when pendingCount > 0 (via `notifiedRef` to prevent repeats)
- Clicking bell opens dropdown showing count and source role ("compras" or "contabilidad")
- Filter chip "Pendiente Revisión" filters to the same criteria as the bell count

### Estados
- `ESTADOS`: `["CONTABILIZADO", "PENDIENTE", "RECHAZADO", "NO RADICADA", "ANULADO"]`
- `ESTADOS_COMPRAS_ALERTA`: subset that triggers review alerts for contabilidad

### Sortable columns
- `sortCol`/`sortDir` state in FacturasTable, `toggleSort` handler
- Clickable `<th>` headers with ▲/▼ indicators, sorts numeric or alphabetic (localeCompare "es")

### Admin-only features
- "Borrar Todo" button visible only for `user.role === "admin"` (not for contabilidad)
- Admin panel for user CRUD

### Predefined responses & ERP prefixes
- Stored in Firebase `config/predefinedResponses` and `config/erpPrefixes`
- Admin can configure via UI; used by EditableCell for `combo`/`select`/`prefixed` field types

## Dev
```bash
npm run dev    # Vite dev server on port 5173
npm run build  # production build
```

Without Firebase env vars, the app uses sample data from `constants.js`.
