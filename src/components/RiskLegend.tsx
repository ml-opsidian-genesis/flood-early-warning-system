import { RISK_COLORS } from "@/lib/risk";

const ITEMS: { label: string; range: string; color: string }[] = [
  { label: "Low", range: "0–25%", color: RISK_COLORS.Low },
  { label: "Moderate", range: "25–50%", color: RISK_COLORS.Moderate },
  { label: "High", range: "50–75%", color: RISK_COLORS.High },
  { label: "Critical", range: "75–100%", color: RISK_COLORS.Critical },
];

export default function RiskLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {ITEMS.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: it.color }} />
          <b>{it.label}</b> <span className="text-slate-400">{it.range}</span>
        </span>
      ))}
    </div>
  );
}
