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
- `src/components/ContratosModule.jsx` + `src/contratosFirebase.js` + `src/contratosExcel.js` — módulo Contratos (contabilidad), fuente = Excel "Cuadro de Experiencia" (una hoja por constructora, 23 columnas definidas en `CAMPOS`; ya no hay % de ejecución). Botón "Subir Excel" (rechaza >20 MB; `leerCuadro` detecta la fila de encabezados en las primeras 20 filas y mapea por nombre; resumen y confirmación; agrupa por hoja + contrato canónico (solo A–Z0–9, así "CO No. 1-MO" = "CO No.1-MO"; la clave sigue siendo `contratoKey` de la primera fila); `aplicarAlias` aplica `contratosAlias/{keyOrigen}=keyDestino` (memoria de uniones: el grupo origen se agrega al destino); `guardarCarga` = un `update` multi-path que crea/reemplaza SOLO los contratos del archivo, nunca borra; "Eliminar contrato" en el detalle). RTDB `contratosExcel/contratos/{contratoKey}` (`{hoja, contrato, orden, filas:[{tipo,...campos}]}`, contratoKey = hoja|CONTRATO normalizado), `contratosExcel/_meta` (última carga) y `contratosNotas/{contratoKey}` (fecha compromiso + comentarios, las cargas no lo tocan). Cada otrosí/liquidación lleva `modifica` (TIEMPO | VALOR | TIEMPO Y VALOR; se infiere de TIPO/OBJETO con `inferirModifica` si falta, editable en el detalle): `fechaFinVigente` = fecha fin de la última fila que modifica TIEMPO y `valorVigente` = valor de la última que modifica VALOR (si no hay, la fila base); las alarmas y la columna Valor usan los vigentes. ESTADO DE LA OBRA es un select (EN EJECUCIÓN | RENOVADO | EN LIQUIDACIÓN | FINALIZADO; un valor distinto se muestra como "(actual: X)" sin migrar); solo FINALIZADO nunca alarma (filtro Finalizados). Edición por fila en el detalle (`setCampoFila`, guarda al salir de la casilla; T/U/V calculadas). "Unir a otro contrato…" / "Mover esta fila…" (`planMover`: un solo update en la raíz con filas, alias, comentarios) y "Sugerencias de corrección (N)" (`sugerencias`: mismo contrato canónico con claves distintas, o sin número/sin fila base con el mismo proyecto que uno anterior de la hoja; "Ignorar" = `contratosNotas/{key}/ignorarSugerencia`). "⬇ Exportar Excel" abre un modal (lista por constructora con búsqueda; formato una hoja por constructora | una sola hoja "Contratos" con columna HOJA; contenido completo | solo el contrato general con valor/fecha/estado vigentes; `exportContratosExcel` en utils.js → `construirLibro`); siempre añade la columna MODIFICA al final y el importador la lee (re-importable). "＋ Nuevo contrato" (modal con `CAMPOS`, hoja = combobox; bloquea si la clave ya existe; `crearContrato` con `set`, `archivo:"portal"`, `orden` vía `siguienteOrden`) y "＋ Agregar otrosí / liquidación" en el detalle (`agregarFila` + `filaNueva`); una carga posterior con la misma clave lo reemplaza. `contratosMonday` y el flujo n8n Contratos-Lutec ya no se usan. Prueba: `node src/contratosExcel.check.js`
- `src/components/CarteraModule.jsx` + `src/carteraExcel.js` + `src/carteraFirebase.js` — módulo Cartera (contabilidad + admin), paso 1: "Subir corte" del "Estado de Cuenta 30-60-90" de World Office (hoja `ExportarAExcel`; `leerCartera` toma la fecha de corte del título, detecta encabezados por nombre, abre cliente en filas "Cliente", arrastra sucursal/dirección/vendedor, ignora filas Total; clave = `nit|direccion|doc|num` saneada, duplicados con `#2`). Un corte por día (re-subir reemplaza). RTDB `cartera/cortes/{YYYY-MM-DD}` = `{at, autor, archivo, facturas}` (pesado: solo `get` del elegido y su anterior) y `cartera/resumen/{fecha}` = `resumenCorte` (liviano: lista de cortes y evolución); ambos en un `update`. `compararCortes` → nuevas / salieron / cambios de valor / cambios de rango + cascada (saldoAnt + nuevas − salieron + ajustes = saldoAct). Panel con KPIs, gráficas SVG propias (cascada, rangos, evolución, top 10), pestañas Todas (por defecto, todo el corte) | Nuevas | Salieron | Cambios de valor | Cambios de rango con búsqueda + filtros compartidos (cliente, rango, doc, vendedor, solo vencidas) y suma de lo filtrado, orden por columna, export (`libroComparacion`, hojas Todas y Filtro) e imprimir. Usa `p()` de contratosFirebase (modo prueba). Vista "Cruce con banco" (`CruceBanco.jsx`): "Subir extracto" (`leerBanco`: hoja `Movimientos1`, solo "Nota Crédito", fecha DD/MM/YYYY | Date | serial) → `cartera/banco/{id}` (re-subir actualiza Tercero/Fin, nunca toca conciliaciones); cliente por `clienteDe` (alias `cartera/alias/{aliasKey(tercero)}` > nombre del Tercero > NIT de la descripción); `sugerir` = DFS acotada (≤6 docs, 20 000 nodos) con pago/suma ∈ [0.88, 1.001] (exacto ≤ $1.000, retención, abono parcial), prioriza facturas que salieron en el corte siguiente al pago (pool = último corte ≤ fecha del pago). Confirmar/Descartar/Reabrir → `cartera/conciliacion/{id}` (+ alias si el cliente fue manual o por NIT) en un update. KPIs recaudo/conciliado/pendiente/retención implícita, "Facturas que salieron sin pago asociado" (bajo demanda) y `libroConciliacion`. Prueba: `node src/carteraExcel.check.js [corteAnt.xlsx corteAct.xlsx [extracto.xlsx]]`
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
- Four roles: `admin` (sees all modules + manages users), `contabilidad`, `compras`, `ingenieria` (el Portal le muestra SOLO el módulo Contratos; constants: `roles: ["contabilidad","ingenieria"]`, el filtro del Portal soporta `mod.roles`)
- Admin bootstrap: on first run, if `/users` is empty, seeds "Catalina Carranza" and "Marco Torres" as admins with default password `lutec2026`
- Session stored in `sessionStorage("lutec_session")` as JSON `{ id, name, role }` — closing tab = logout
- Admin in facturas module operates as contabilidad role (`isCont = true`)
- External modules keep their own shared passwords (PasswordGate)

## Key patterns

### Contratos v5: permisos, eliminación, historial y modo prueba
- Permisos en RTDB `contratosPermisos/{userId}` = `{ editar: "ninguno"|"todo"|"hojas", hojas: {hojaKey: true}, eliminar }` (NO dentro de `/users`). Solo el admin los asigna (AdminPanel > "Permisos Contratos"). `permisosContratos(user, registro)` en contratosExcel.js: admin = todo + eliminar siempre; sin registro: contabilidad edita todo sin eliminar, ingeniería/otros solo ven. Se aplican en la interfaz (no hay Firebase Auth). Editar = por constructora (hoja); subir Excel y crear hojas nuevas solo con "Editar todo"; Mover/Unir/Sugerencias exigen permiso en las dos hojas; comentarios y fecha de compromiso abiertos a todos.
- Eliminar (`puedeEliminar` + permiso en la hoja): 🗑 por fila (`planEliminarFila`; si es la única, elimina el contrato), "Eliminar contrato" y "Eliminar constructora" (modal: escribir el nombre de la hoja; `planEliminarHoja`; las notas no se borran).
- Historial `contratosHistorial/{pushId}` = `{at, usuario, accion, hoja, contratoKey, contrato, detalle, ...}`: cada mutación del módulo va en el MISMO update raíz que el cambio (`plan*` puros en contratosExcel.js, aplicados con `aplicarCambios`). Solo admin: botón "Historial" (`HistorialContratos.jsx`: filtros, "cargar más", export .xlsx) y sección "Historial de este contrato" (sale de las últimas 200 entradas).
- Modo prueba: `VITE_CONTRATOS_PRUEBA=1` en `.env.local` (git-ignorado) antepone `pruebas/` a TODAS las rutas del módulo vía `p()` en contratosFirebase.js (`aplicarCambios` prefija las claves). Banner amarillo fijo; el admin tiene "Copiar datos de producción a prueba" (lee prod, escribe `pruebas/`). Sin la variable (Netlify) las rutas son las de producción.
- Importador sin columna HOJA: `leerCuadro` marca `_sinHoja` (y devuelve `sinHoja`); `ubicarHojas(filas, existentes)` reubica cada contrato en su constructora por número canónico (ignorando la hoja "Contratos"); el modal avisa y ofrece "Subir solo los ubicados" (por defecto) / "Subir todo igual", y advierte si crearía >50 contratos en una constructora nueva.
- Contratos y Aclaración Facturas usan todo el ancho (padding lateral `clamp(16px,2vw,24px)`).

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
