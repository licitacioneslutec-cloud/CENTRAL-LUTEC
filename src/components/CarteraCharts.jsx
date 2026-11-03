// Gráficos SVG (sin librerías) y tarjetas compartidas por Cartera y Conciliación Proveedores.
import { C } from "../constants";
import { fmt, corto, fmtF } from "../utils";

const card = { background: C.white, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 14 };

const W = 560, H = 240, M = { l: 12, r: 12, t: 20, b: 30 };
const Svg = ({ children }) => <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>{children}</svg>;
const escala = (lo, hi, a, b) => (v) => a + ((v - lo) / (hi - lo || 1)) * (b - a);

// items: [{label, de, a, color, txt}]; barra de de→a. Sin items, la cascada de cortes de Cartera.
export function Cascada({ cas, items }) {
  const { saldoAnt, nuevas, salieron, ajustes, saldoAct } = cas || {};
  const it = items || [
    { label: "Saldo anterior", de: 0, a: saldoAnt, color: C.navy, txt: corto(saldoAnt) },
    { label: "Nuevas", de: saldoAnt, a: saldoAnt + nuevas, color: C.red, txt: "+" + corto(nuevas) },
    { label: "Salieron", de: saldoAnt + nuevas, a: saldoAnt + nuevas - salieron, color: C.green, txt: "−" + corto(salieron) },
    { label: "Ajustes", de: saldoAnt + nuevas - salieron, a: saldoAct, color: C.orange, txt: (ajustes < 0 ? "−" : "+") + corto(Math.abs(ajustes)) },
    { label: "Saldo actual", de: 0, a: saldoAct, color: C.navy, txt: corto(saldoAct) },
  ];
  // Eje truncado: las variaciones diarias son diminutas frente al saldo
  const niv = it.flatMap((x) => [x.de ? x.de : null, x.a].filter((v) => v !== null));
  const mn = Math.min(...niv), mx = Math.max(...niv), sp = (mx - mn) || Math.abs(mx) || 1;
  const lo = mn - sp * 0.6, hi = mx + sp * 0.25, y = escala(lo, hi, H - M.b, M.t);
  const bw = (W - M.l - M.r) / it.length;
  return (
    <Svg>
      {it.map((x, i) => {
        const y1 = y(x.de || lo), y2 = y(x.a), top = Math.min(y1, y2), h = Math.max(Math.abs(y1 - y2), 2);
        return (
          <g key={x.label}>
            <rect x={M.l + i * bw + bw * 0.15} y={top} width={bw * 0.7} height={h} fill={x.color} rx={2} />
            <text x={M.l + i * bw + bw / 2} y={top - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.g900}>{x.txt}</text>
            <text x={M.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={C.g500}>{x.label}</text>
          </g>
        );
      })}
    </Svg>
  );
}

// datos: [{label, valor, color?}]; sin color, el de Cartera (primera azul, siguientes naranja, el resto rojo)
export function BarrasV({ datos }) {
  const mx = Math.max(0, ...datos.map((d) => d.valor)), mn = Math.min(0, ...datos.map((d) => d.valor));
  const y = escala(mn, mx, H - M.b, M.t + 8), bw = (W - M.l - M.r) / datos.length;
  return (
    <Svg>
      <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke={C.g300} />
      {datos.map((d, i) => {
        const y1 = y(0), y2 = y(d.valor);
        return (
          <g key={d.label}>
            <rect x={M.l + i * bw + bw * 0.15} y={Math.min(y1, y2)} width={bw * 0.7} height={Math.max(Math.abs(y1 - y2), 1)} fill={d.color || (i === 0 ? C.blue : i < 3 ? C.orange : C.red)} rx={2} />
            <text x={M.l + i * bw + bw / 2} y={Math.min(y1, y2) - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.g900}>{corto(d.valor)}</text>
            <text x={M.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={C.g500}>{d.label}</text>
          </g>
        );
      })}
    </Svg>
  );
}

// puntos: [{fecha, ...}]; series: [[clave, color, etiqueta]]
export function Linea({ puntos, series = [["total", C.navy, "Total"], ["vencido", C.red, "Vencido"]] }) {
  if (puntos.length < 2) return <div style={{ fontSize: 12, color: C.g500, padding: "40px 0", textAlign: "center" }}>Se necesitan al menos 2 cortes para ver la evolución.</div>;
  const vals = puntos.flatMap((q) => series.map(([k]) => q[k]));
  const mx = Math.max(...vals), mn = Math.min(0, ...vals);
  const y = escala(mn, mx, H - M.b, M.t + 10), x = (i) => M.l + 30 + (i / (puntos.length - 1)) * (W - M.l - M.r - 60);
  const tr = (k) => puntos.map((q, i) => `${x(i)},${y(q[k])}`).join(" ");
  const ult = puntos.length - 1;
  return (
    <Svg>
      {series.map(([k, col, et]) => (
        <g key={k}>
          <polyline points={tr(k)} fill="none" stroke={col} strokeWidth={2} />
          {puntos.map((q, i) => <circle key={q.fecha} cx={x(i)} cy={y(q[k])} r={3} fill={col}><title>{`${fmtF(q.fecha)}: ${fmt(q[k])}`}</title></circle>)}
          <text x={x(ult)} y={y(puntos[ult][k]) - 8} textAnchor="end" fontSize={11} fontWeight={700} fill={col}>{et} {corto(puntos[ult][k])}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 10} textAnchor="start" fontSize={11} fill={C.g500}>{fmtF(puntos[0].fecha)}</text>
      <text x={x(ult)} y={H - 10} textAnchor="end" fontSize={11} fill={C.g500}>{fmtF(puntos[ult].fecha)}</text>
    </Svg>
  );
}

// datos: [{cli, valor}] (cli único: es la key); saldos negativos en rojo con su ancho real; onClick(cli) y sel resaltan la barra
export function BarrasH({ datos, sel, onClick }) {
  const mx = Math.max(1, ...datos.map((d) => Math.abs(d.valor))), fila = 22, h = datos.length * fila + 8, tx = 190;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {datos.map((d, i) => {
        const ancho = Math.max((Math.abs(d.valor) / mx) * (W - tx - 80), 1);
        return (
          <g key={d.cli} onClick={onClick ? () => onClick(d.cli) : undefined} style={{ cursor: onClick ? "pointer" : "default" }} opacity={sel && sel !== d.cli ? 0.35 : 1}>
            <title>{`${d.cli}: ${fmt(d.valor)}`}</title>
            <rect x={0} y={i * fila} width={W} height={fila} fill={sel === d.cli ? C.blueL : "transparent"} />
            <text x={tx - 6} y={i * fila + 16} textAnchor="end" fontSize={11} fontWeight={sel === d.cli ? 700 : 400} fill={C.g700}>{d.cli.length > 30 ? d.cli.slice(0, 29) + "…" : d.cli}</text>
            <rect x={tx} y={i * fila + 5} width={ancho} height={14} fill={d.valor < 0 ? C.red : C.blue} rx={2} />
            <text x={tx + ancho + 5} y={i * fila + 16} fontSize={11} fontWeight={700} fill={d.valor < 0 ? C.red : C.g900}>{corto(d.valor)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export const Kpi = ({ label, valor, sub, color = C.navy }) => (
  <div style={{ ...card, flex: "1 1 160px" }}>
    <div style={{ fontSize: 10, color: C.g500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
    {sub && <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>{sub}</div>}
  </div>
);
export const Panel = ({ titulo, children }) => (
  <div style={{ ...card, flex: "1 1 420px", minWidth: 0 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{titulo}</div>
    {children}
  </div>
);
