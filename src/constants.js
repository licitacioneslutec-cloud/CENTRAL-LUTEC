// ─── Company structure ───
export const DEPARTMENTS = [
  {
    id: "presupuestos", name: "Presupuestos", icon: "📐", desc: "Cotizaciones y análisis de bolsas de proyectos",
    modules: [
      { id: "cotizaciones", name: "Cotizaciones Eléctricas", desc: "Gestión de cotizaciones por proyecto", type: "external", url: "https://cotizacioneslutec.netlify.app/", status: "activo", password: "3635088e5f50b74780054cb808bb38f1e0d75b5a1b8d19c70d8e1b1bc091f4e2" },
      { id: "bolsas", name: "Bolsas", desc: "Análisis y control de bolsas de proyectos", type: "external", url: "https://effervescent-haupia-f573df.netlify.app/", status: "activo", password: "3635088e5f50b74780054cb808bb38f1e0d75b5a1b8d19c70d8e1b1bc091f4e2" },
    ],
  },
  {
    id: "ingenieria", name: "Ingeniería", icon: "⚡", desc: "Gestión de contratos y recarga de proyectos",
    modules: [
      { id: "recarga", name: "Recarga Contratos", desc: "Control y seguimiento de recarga de contratos", type: "external", url: "https://contratos-ingenieria.netlify.app/", status: "activo", password: "ca9bbefa0b92bd0dae875d23711c2dc947d10811674284b0b831f863bcef4d05" },
    ],
  },
  {
    id: "compras", name: "Compras", icon: "🛒", desc: "Actualización Monday, estados mensuales y aclaraciones de facturación",
    modules: [
      { id: "monday", name: "Actualización Monday", desc: "Sincronización y actualización de tableros Monday", type: "external", url: "https://compras-comisiones.netlify.app/importar.html", status: "activo", password: "70cdf58e67eae5886ad2e3bd5fb1b8c5bae65db772180f64cb5e9066b13f0a72" },
      { id: "estado-mensual", name: "Estado Compras Mensual", desc: "Reporte mensual del estado de compras", type: "external", url: "https://compras-comisiones.netlify.app/", status: "activo", password: "ba9cbe46d59bc71309a935f738b132fb6ee84f4add7fdecd637de502198f55a9" },
      { id: "facturas", name: "Aclaración Facturas", desc: "Responder solicitudes de aclaración de contabilidad", type: "internal", status: "activo", role: "compras" },
    ],
  },
  {
    id: "contabilidad", name: "Contabilidad", icon: "📊", desc: "Radicación de facturas y lectura de órdenes de compra DIAN",
    modules: [
      { id: "facturas", name: "Aclaración Facturas", desc: "Radicación de facturas con novedades y no radicadas", type: "internal", status: "activo", role: "contabilidad" },
      { id: "oc-dian", name: "Lectura OC DIAN", desc: "Lectura de órdenes de compra desde la DIAN", type: "internal", status: "proximamente" },
    ],
  },
];

// ─── Sample data ───
export const SAMPLE_FACTURAS = [
  { id:1, tipoDoc:"Factura electrónica", cufe:"6e4b9cc56e4efc925699b5b425e558819657285ba043040ef957e43bde36be79a848651cd028aa98b4020780a14b6be2", folio:"41553835", prefijo:"", divisa:"COP", formaPago:"1", medioPago:"42", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 15:23:07", nitEmisor:"860001022", nombreEmisor:"CASA EDITORIAL EL TIEMPO S.A.", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC SAS", iva:53580, total:335580, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"CONTABILIZADO", observacion:"", rtaCompras:"NO ES DE COMPRAS" },
  { id:2, tipoDoc:"Factura electrónica", cufe:"7fa927a5157d34483ccd146b8ac83800c2bdb041048196fd02e9e6ef9acc95694d3e5a19b49c379cb92ff05ce0c91dab", folio:"25419", prefijo:"FVE", divisa:"COP", formaPago:"2", medioPago:"1", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 17:14:47", nitEmisor:"900199049", nombreEmisor:"DISTRIELECTRICOS BKM S.A.S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:1050674, total:6580539, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"PENDIENTE", observacion:"", rtaCompras:"NO FACTURARON CAJA DE INSPECCIÓN 30X30 LUT00879" },
  { id:3, tipoDoc:"Factura electrónica", cufe:"936b099792a61240bb84e643c1695ae6f5677ca542f97f2b1bc079cf5bdad30e311604585d8002afea4480d07c290579", folio:"5225", prefijo:"LS", divisa:"COP", formaPago:"2", medioPago:"ZZZ", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 10:23:58", nitEmisor:"900961005", nombreEmisor:"LOPEZ SERVICE SAS", nitReceptor:"900491816", nombreReceptor:"Grupo Lutec S.A.S.", iva:83908, total:525531, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"RECHAZADO", observacion:"OC 27164,27156", rtaCompras:"NO ES DE COMPRAS" },
  { id:4, tipoDoc:"Factura electrónica", cufe:"74f62adcbe18327c367e9cf4c3a270b851016b74f1010007c92d0ec990c7a2344dd9f9a9bc669efc443a79625048da9a", folio:"1008067", prefijo:"SBO", divisa:"COP", formaPago:"2", medioPago:"30", fechaEmision:"15-08-2026", fechaRecepcion:"15-08-2026 10:26:45", nitEmisor:"901254982", nombreEmisor:"DISTRIBUCIONES ELECTRICAS", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:881102, total:5518482, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"", observacion:"", rtaCompras:"OC 26979" },
  { id:5, tipoDoc:"Factura electrónica", cufe:"e82c64e80dc2fb4baa0fa116ddf4104b031a6d6be8c8d0c2c6750d9e588d5121c1fa1f940cd9bf0cb2eeb372433c4ef2", folio:"255421", prefijo:"FE", divisa:"COP", formaPago:"2", medioPago:"1", fechaEmision:"15-08-2026", fechaRecepcion:"15-08-2026 12:01:35", nitEmisor:"900224641", nombreEmisor:"FERRELECTRICOS DIEGO NOVOA S A S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:215870, total:1352029, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"", observacion:"", rtaCompras:"OC 27156" },
  { id:6, tipoDoc:"Factura electrónica", cufe:"e4c49e51268e4c0dd671762cccb773fa2ae0870a05d1242c750392ad31046c823edbcf93e2518b9524b3df3be3e08718", folio:"13869", prefijo:"ELEC", divisa:"COP", formaPago:"2", medioPago:"ZZZ", fechaEmision:"18-08-2026", fechaRecepcion:"18-08-2026 17:36:05", nitEmisor:"901457522", nombreEmisor:"C.I. IMPORTADORES DE DATOS Y SEGURIDAD S.A.S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC SAS", iva:10125860, total:63419860, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"", observacion:"", rtaCompras:"OC 27259" },
  { id:7, tipoDoc:"Factura electrónica", cufe:"dac5b0b35ac90077f211fc1079d43af5bd5661d250e10f2f9a4bbea5d7f3d7793197749ba86cd486ae13bc745fb78491", folio:"1008079", prefijo:"SBO", divisa:"COP", formaPago:"2", medioPago:"30", fechaEmision:"18-08-2026", fechaRecepcion:"18-08-2026 09:42:22", nitEmisor:"901254982", nombreEmisor:"DISTRIBUCIONES ELECTRICAS", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:1927283, total:12070879, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"", observacion:"", rtaCompras:"OC 26952" },
  { id:8, tipoDoc:"Factura electrónica", cufe:"7255898883bc385787c43e941756341f4d40f9f175d4f4bb2aadfd742fbdd0c4cd870e29040f02759801b481ac09f328", folio:"25430", prefijo:"FVE", divisa:"COP", formaPago:"2", medioPago:"1", fechaEmision:"18-08-2026", fechaRecepcion:"18-08-2026 10:36:10", nitEmisor:"900199049", nombreEmisor:"DISTRIELECTRICOS BKM S.A.S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:494868, total:3099439, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"", observacion:"", rtaCompras:"REALIZADO" },
  // Former SAMPLE_NO_RADICADAS rows, folded in with estado: "NO RADICADA".
  { id:101, tipoDoc:"Factura electrónica", cufe:"671099d495dfcb008b5e5efe7b653efcb26af48d01c4fcab03970626c409e5a365a9139c645921e3c78797f1f4413bc2", folio:"2591", prefijo:"ECO", divisa:"COP", formaPago:"2", medioPago:"ZZZ", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 17:13:56", nitEmisor:"900762116", nombreEmisor:"ECOENERGIA TECNOLOGIA INNOVACION S A S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC SAS", iva:269555, total:1688266, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"NO RADICADA", observacion:"no radicadas en Monday", rtaCompras:"" },
  { id:102, tipoDoc:"Factura electrónica", cufe:"e7a166fa4326b33dcadcae0e2bab9715bb5b1385392fa00eca192927592feade10d594a9ad5768ab72bbca9d6515af6b", folio:"1363697", prefijo:"FEPQ", divisa:"COP", formaPago:"2", medioPago:"47", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 08:33:41", nitEmisor:"830087721", nombreEmisor:"ILUMINACION Y MATERIALES ELECTRICOS SAS", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S.A.S.", iva:1017244, total:6371164, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"NO RADICADA", observacion:"no radicadas en Monday", rtaCompras:"" },
  { id:103, tipoDoc:"Factura electrónica", cufe:"bedeac36140cd9c1f8f55b1b61fa590d116cc7e409bcc31391eb6ed1c9fa64b0f3c94aae40610ae3cd27aed2be55faec", folio:"315", prefijo:"FEV", divisa:"COP", formaPago:"2", medioPago:"ZZZ", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 22:01:48", nitEmisor:"901865641", nombreEmisor:"IXACTECH SAS", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC SAS", iva:104120, total:652120, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"NO RADICADA", observacion:"no radicadas en Monday", rtaCompras:"" },
  { id:104, tipoDoc:"Factura electrónica", cufe:"91054c7a21936070b6b7e993cd745f0203b1e8640c0c0f0c5426e112c72ecb3e76950a3939eb70a4234e936b7a2d12d6", folio:"14200", prefijo:"FUZU", divisa:"COP", formaPago:"2", medioPago:"1", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 13:41:31", nitEmisor:"860047906", nombreEmisor:"MARPED GROUP S.A.S", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:6612, total:41412, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"NO RADICADA", observacion:"no radicadas en Monday", rtaCompras:"" },
  { id:105, tipoDoc:"Factura electrónica", cufe:"01d68936f03a23a6b405f785ba18af9397c7d9751ed62491b4461abe28197364645ce30e30d98a8631d29212708e49e4", folio:"25197", prefijo:"SCA", divisa:"COP", formaPago:"2", medioPago:"30", fechaEmision:"14-08-2026", fechaRecepcion:"14-08-2026 11:39:22", nitEmisor:"901254982", nombreEmisor:"DISTRIBUCIONES ELECTRICAS", nitReceptor:"900491816", nombreReceptor:"GRUPO LUTEC S A S", iva:102271, total:640537, estadoDoc:"Aprobado con notificación", grupo:"Recibido", estado:"NO RADICADA", observacion:"no radicadas en Monday", rtaCompras:"" },
];

// ─── Estados (extensible list, not enum) ───
export const ESTADOS = ["CONTABILIZADO", "PENDIENTE", "RECHAZADO", "NO RADICADA"];

// ─── Column definitions ───
export const ALL_FIELDS = [
  { key: "tipoDoc", label: "Tipo Doc.", w: 100, editable: "contabilidad", type: "text" },
  { key: "cufe", label: "CUFE/CUDE", w: 120, editable: "contabilidad", type: "text" },
  { key: "folio", label: "Folio", w: 90, editable: "contabilidad", type: "text" },
  { key: "prefijo", label: "Prefijo", w: 70, editable: "contabilidad", type: "text" },
  { key: "divisa", label: "Divisa", w: 60, editable: "contabilidad", type: "text" },
  { key: "formaPago", label: "F. Pago", w: 65, editable: "contabilidad", type: "text" },
  { key: "medioPago", label: "M. Pago", w: 65, editable: "contabilidad", type: "text" },
  { key: "fechaEmision", label: "F. Emisión", w: 95, editable: "contabilidad", type: "text" },
  { key: "fechaRecepcion", label: "F. Recepción", w: 95, editable: "contabilidad", type: "text" },
  { key: "nitEmisor", label: "NIT Emisor", w: 95, editable: "contabilidad", type: "text" },
  { key: "nombreEmisor", label: "Nombre Emisor", w: 180, editable: "contabilidad", type: "text" },
  { key: "nitReceptor", label: "NIT Receptor", w: 95, editable: "contabilidad", type: "text" },
  { key: "nombreReceptor", label: "Nombre Receptor", w: 140, editable: "contabilidad", type: "text" },
  { key: "iva", label: "IVA", w: 90, numeric: true, editable: "contabilidad", type: "text" },
  { key: "total", label: "Total", w: 100, numeric: true, editable: "contabilidad", type: "text" },
  { key: "estadoDoc", label: "Estado Doc.", w: 110, editable: "contabilidad", type: "text" },
  { key: "grupo", label: "Grupo", w: 80, editable: "contabilidad", type: "text" },
  { key: "estado", label: "Estado Contab.", w: 120, editable: "contabilidad", type: "select" },
  { key: "observacion", label: "Observación Contab.", w: 160, editable: "contabilidad", type: "text" },
  { key: "rtaCompras", label: "Rta. Compras", w: 180, editable: "compras", type: "text" },
  { key: "rtaContabilidad", label: "Rta. Contabilidad", w: 180, editable: "contabilidad", type: "text" },
  { key: "nERP", label: "N° ERP", w: 100, editable: "contabilidad", type: "text" },
  { key: "valorContabilizado", label: "Val. Contabilizado", w: 130, editable: "contabilidad", type: "text", numeric: true },
];

// ─── Color palette ───
export const C = {
  navy: "#1a2740", navyLight: "#243351", accent: "#8cb63c", accentDark: "#6d9a1e",
  white: "#fff", off: "#f7f8fa", g100: "#f0f1f4", g200: "#e2e4e9", g300: "#c8ccd4",
  g500: "#6b7280", g700: "#374151", g900: "#1f2937",
  red: "#dc2626", redL: "#fef2f2", orange: "#f59e0b", orangeL: "#fffbeb",
  green: "#16a34a", greenL: "#f0fdf4", blue: "#2563eb", blueL: "#eff6ff",
};
