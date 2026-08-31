import { C } from "../constants";
import { fmt } from "../utils";

// ─── Summary stats line ───
export default function StatsBar({ stats }) {
  return (
    <div style={{ fontSize: 11, color: C.g500 }}>
      Total: <strong style={{ color: C.navy }}>{fmt(stats.totalVal)}</strong> · Sin respuesta:{" "}
      <strong style={{ color: C.red }}>{stats.sinRta}</strong>
    </div>
  );
}
