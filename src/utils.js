// Formats a number as Colombian peso currency, e.g. fmt(335580) -> "$335.580"
export const fmt = (n) => (!n && n !== 0 ? "$0" : "$" + Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 }));
