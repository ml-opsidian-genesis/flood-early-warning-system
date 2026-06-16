import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  simulated: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

export default async function AlertsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/alerts");

  const [alerts, byStatus, total] = await Promise.all([
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.alert.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.alert.count(),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<
    string,
    number
  >;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alert delivery log</h1>
        <p className="text-sm text-slate-500">
          Every WhatsApp alert the pipeline attempted, newest first.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total attempts" value={total} />
        <Stat label="Sent" value={counts.sent ?? 0} />
        <Stat label="Failed" value={counts.failed ?? 0} />
        <Stat label="Simulated" value={counts.simulated ?? 0} />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Risk</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No alerts yet. Run the pipeline when a subscribed location is high-risk.
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                    {a.createdAt.toLocaleString()}
                  </td>
                  <td className="font-medium">
                    {a.locationName}
                    <span className="font-normal text-slate-400">, {a.district}</span>
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
                  <td className="text-slate-500">{a.channel}</td>
                  <td>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[a.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate text-xs text-slate-400" title={a.detail ?? ""}>
                    {a.detail ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > alerts.length && (
        <p className="text-xs text-slate-400">Showing the {alerts.length} most recent of {total}.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
