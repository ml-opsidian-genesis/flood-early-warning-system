import { RISK_COLORS, DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/risk";

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

export default function RiskLegend({ thresholds }: { thresholds?: Thresholds }) {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const items = [
    { label: "Low", range: `0–${pct(t.moderateMin)}`, color: RISK_COLORS.Low },
    { label: "Moderate", range: `${pct(t.moderateMin)}–${pct(t.highMin)}`, color: RISK_COLORS.Moderate },
    { label: "High", range: `${pct(t.highMin)}–${pct(t.criticalMin)}`, color: RISK_COLORS.High },
    { label: "Critical", range: `${pct(t.criticalMin)}–100%`, color: RISK_COLORS.Critical },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: it.color }} />
          <b>{it.label}</b> <span className="text-slate-400">{it.range}</span>
        </span>
      ))}
    </div>
  );
}
