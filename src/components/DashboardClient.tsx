"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Skeleton } from "antd";
import { runNowAction } from "@/app/actions";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";

type Stats = {
  subscribers: number;
  subscriptions: number;
  alertsSent: number;
  lastRun: {
    scoredFor: string;
    locationCount: number;
    highRiskCount: number;
    alertsSent: number;
    modelVersion: string | null;
    status: string;
    createdAt: string;
  } | null;
  distribution: Record<string, number>;
  recentAlerts: {
    phone: string;
    locationName: string;
    district: string;
    score: number;
    riskLevel: string;
    status: string;
    createdAt: string;
  }[];
};

const LEVELS: RiskLevel[] = ["Low", "Moderate", "High", "Critical"];

function Card({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(() => {
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(() => setStats(null));
    });
  }, [startTransition]);

  useEffect(load, [load]);

  function runNow() {
    setMessage(null);
    startTransition(async () => {
      const res = await runNowAction();
      if (res.ok) {
        const s = res.summary;
        setMessage(
          `✅ Scored ${s.locationsScored} locations · ${s.highRiskCount} high-risk · ${s.alertsSent} alerts sent (threshold ${s.threshold}).`,
        );
      } else {
        setMessage(`❌ ${res.error}`);
      }
      load();
    });
  }

  const totalScored = stats ? Object.values(stats.distribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">
            Monitor the daily scoring pipeline and alert delivery.{" "}
            <Link href="/locations" className="text-blue-600 hover:underline">
              Manage locations &amp; risk values →
            </Link>
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Running pipeline…" : "Run morning pipeline now"}
        </button>
      </div>

      {message && (
        <div className="card border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</div>
      )}

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Verified subscribers" value={<Skeleton active paragraph={false} />} />
          <Card label="Active subscriptions" value={<Skeleton active paragraph={false} />} />
          <Card label="Alerts delivered" value={<Skeleton active paragraph={false} />} />
          <Card label="Last run" value={<Skeleton active paragraph={false} />} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Verified subscribers" value={stats?.subscribers ?? "—"} />
          <Card label="Active subscriptions" value={stats?.subscriptions ?? "—"} />
          <Card label="Alerts delivered" value={stats?.alertsSent ?? "—"} />
          <Card
            label="Last run"
            value={stats?.lastRun ? new Date(stats.lastRun.createdAt).toLocaleString() : "Never"}
          />
        </div>
      )}

      {/* Risk distribution */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">
          Latest risk distribution {totalScored > 0 && `(${totalScored} locations)`}
        </h2>
        {totalScored === 0 ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : (
          <Skeleton active paragraph={false} title={false}>
            <div className="space-y-2">
              {LEVELS.map((level) => {
                const n = stats?.distribution[level] ?? 0;
                const pct = totalScored ? (n / totalScored) * 100 : 0;
                return (
                  <div key={level} className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-slate-600">{level}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-full rounded"
                        style={{ width: `${pct}%`, backgroundColor: RISK_COLORS[level] }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-slate-500">{n}</span>
                  </div>
                );
              })}
            </div>
          </Skeleton>
        )}
      </div>

      {/* Recent alerts */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Recent alerts</h2>
        {!stats || stats.recentAlerts.length === 0 ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2">Location</th>
                  <th>Phone</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAlerts.map((a, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2">
                      {a.locationName}, {a.district}
                    </td>
                    <td className="text-slate-500">{a.phone}</td>
                    <td>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: RISK_COLORS[a.riskLevel as RiskLevel] ?? "#64748b" }}
                      >
                        {a.riskLevel} {(a.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-slate-500">{a.status}</td>
                    <td className="text-slate-400">{new Date(a.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
