import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { riskColor } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SubscribersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?from=/subscribers");

  const thresholds = await getThresholds();

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { subscriptions: true, alerts: true } },
      subscriptions: {
        include: {
          location: {
            // Most recent score per location, to show current risk.
            include: { scores: { orderBy: { scoredFor: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  const verifiedCount = subscribers.filter((s) => s.verified).length;
  const totalSubscriptions = subscribers.reduce((n, s) => n + s._count.subscriptions, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
        <p className="text-sm text-slate-500">
          People receiving alerts and the locations they follow.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total subscribers" value={subscribers.length} />
        <Stat label="Verified" value={verifiedCount} />
        <Stat label="Total subscriptions" value={totalSubscriptions} />
      </div>

      {subscribers.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">No subscribers yet.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Phone</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Alerts</th>
                <th className="w-1/2">Subscribed locations</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">{s.phone}</td>
                  <td>
                    {s.verified ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                        verified
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        unverified
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-slate-500">
                    {s.createdAt.toLocaleDateString()}
                  </td>
                  <td className="tabular-nums text-slate-500">{s._count.alerts}</td>
                  <td className="py-3">
                    {s.subscriptions.length === 0 ? (
                      <span className="text-slate-400">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {s.subscriptions.map((sub) => {
                          const score = sub.location.scores[0]?.score ?? null;
                          return (
                            <span
                              key={sub.id}
                              className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs"
                            >
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: score != null ? riskColor(score, thresholds) : "#94a3b8" }}
                              />
                              {sub.location.name}
                              {score != null && (
                                <span className="text-slate-400">{(score * 100).toFixed(0)}%</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
