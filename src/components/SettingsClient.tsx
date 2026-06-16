"use client";

import { useEffect, useState } from "react";
import { RISK_COLORS } from "@/lib/risk";

type Thresholds = {
  moderateMin: number;
  highMin: number;
  criticalMin: number;
  alertThreshold: number;
};

const FIELDS: { key: keyof Thresholds; label: string; help: string }[] = [
  { key: "moderateMin", label: "Moderate starts at", help: "Score ≥ this is at least Moderate" },
  { key: "highMin", label: "High starts at", help: "Score ≥ this is at least High" },
  { key: "criticalMin", label: "Critical starts at", help: "Score ≥ this is Critical" },
  { key: "alertThreshold", label: "Alert threshold", help: "Score ≥ this sends a WhatsApp alert" },
];

export default function SettingsClient() {
  const [t, setT] = useState<Thresholds | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setT(d.thresholds))
      .catch(() => setError("Failed to load settings"));
  }, []);

  function update(key: keyof Thresholds, v: string) {
    setT((prev) => (prev ? { ...prev, [key]: v === "" ? NaN : Number(v) } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!t) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setT(data.thresholds);
      setNotice("Saved. Risk levels update immediately; the alert threshold applies on the next pipeline run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (!t) {
    return <p className="text-sm text-slate-400">{error ?? "Loading…"}</p>;
  }

  const valid =
    t.moderateMin < t.highMin &&
    t.highMin < t.criticalMin &&
    [t.moderateMin, t.highMin, t.criticalMin, t.alertThreshold].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk &amp; alert thresholds</h1>
        <p className="text-sm text-slate-500">
          Define how scores map to risk levels, and when an alert is sent. Values are 0–1.
        </p>
      </div>

      {/* Live band preview */}
      <Bands t={t} />

      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{f.label}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={Number.isNaN(t[f.key]) ? "" : t[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">{f.help}</span>
            </label>
          ))}
        </div>

        {!valid && (
          <p className="text-sm text-amber-600">
            Levels must increase: Moderate &lt; High &lt; Critical, and all values within 0–1.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        <button
          type="submit"
          disabled={busy || !valid}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save thresholds"}
        </button>
      </form>
    </div>
  );
}

function Bands({ t }: { t: Thresholds }) {
  const segs = [
    { label: "Low", from: 0, to: t.moderateMin, color: RISK_COLORS.Low },
    { label: "Moderate", from: t.moderateMin, to: t.highMin, color: RISK_COLORS.Moderate },
    { label: "High", from: t.highMin, to: t.criticalMin, color: RISK_COLORS.High },
    { label: "Critical", from: t.criticalMin, to: 1, color: RISK_COLORS.Critical },
  ];
  return (
    <div className="card p-4">
      <div className="mb-2 flex h-6 w-full overflow-hidden rounded">
        {segs.map((s) => {
          const w = Math.max(0, (s.to - s.from) * 100);
          return (
            <div
              key={s.label}
              style={{ width: `${w}%`, backgroundColor: s.color }}
              className="flex items-center justify-center text-[10px] font-medium text-white"
              title={`${s.label}: ${s.from.toFixed(2)}–${s.to.toFixed(2)}`}
            >
              {w > 8 ? s.label : ""}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-800" />
        Alert fires at score ≥ <b>{Number.isNaN(t.alertThreshold) ? "?" : t.alertThreshold.toFixed(2)}</b>
      </div>
    </div>
  );
}
