"use client";

import { useCallback, useEffect, useState } from "react";
import { RISK_COLORS } from "@/lib/risk";
import type { SessionPayload } from "@/lib/session";

type Thresholds = {
  moderateMin: number;
  highMin: number;
  criticalMin: number;
  alertThreshold: number;
};

type AdminRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

const FIELDS: { key: keyof Thresholds; label: string; help: string }[] = [
  { key: "moderateMin", label: "Moderate starts at", help: "Score ≥ this is at least Moderate" },
  { key: "highMin", label: "High starts at", help: "Score ≥ this is at least High" },
  { key: "criticalMin", label: "Critical starts at", help: "Score ≥ this is Critical" },
  { key: "alertThreshold", label: "Alert threshold", help: "Score ≥ this sends a WhatsApp alert" },
];

export default function SettingsClient({ session }: { session: SessionPayload }) {
  const isSuperadmin = session.role === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">
          Risk thresholds, your profile, and admin accounts.
        </p>
      </div>

      {/* Top row: thresholds (left) and profile (right) — equal columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ThresholdsSection />
        <ProfileSection session={session} />
      </div>

      {/* Bottom row: admin management — full width, table + form side-by-side */}
      {isSuperadmin && <AdminsSection currentId={session.sub} />}
    </div>
  );
}

/* ─── Thresholds ─────────────────────────────────────────────────────────── */

function ThresholdsSection() {
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

  if (!t) return <p className="text-sm text-slate-400">{error ?? "Loading…"}</p>;

  const valid =
    t.moderateMin < t.highMin &&
    t.highMin < t.criticalMin &&
    [t.moderateMin, t.highMin, t.criticalMin, t.alertThreshold].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Risk &amp; alert thresholds</h2>
        <p className="text-sm text-slate-500">Define how scores map to risk levels. Values are 0–1.</p>
      </div>

      {/* Live band preview */}
      <div className="card p-4">
        <div className="mb-2 flex h-6 w-full overflow-hidden rounded">
          {(
            [
              { label: "Low", from: 0, to: t.moderateMin, color: RISK_COLORS.Low },
              { label: "Moderate", from: t.moderateMin, to: t.highMin, color: RISK_COLORS.Moderate },
              { label: "High", from: t.highMin, to: t.criticalMin, color: RISK_COLORS.High },
              { label: "Critical", from: t.criticalMin, to: 1, color: RISK_COLORS.Critical },
            ] as const
          ).map((s) => {
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
          Alert fires at score ≥{" "}
          <b>{Number.isNaN(t.alertThreshold) ? "?" : t.alertThreshold.toFixed(2)}</b>
        </div>
      </div>

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

/* ─── Profile ────────────────────────────────────────────────────────────── */

function ProfileSection({ session }: { session: SessionPayload }) {
  const [email, setEmail] = useState(session.email);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailBusy(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEmailMsg({ ok: true, text: "Email updated." });
      setEmail(data.email);
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: "New passwords do not match" });
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch("/api/admin/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwMsg({ ok: true, text: "Password changed successfully." });
      setPw({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-slate-500">
          Signed in as <span className="font-medium">{session.email}</span>{" "}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {session.role}
          </span>
        </p>
      </div>

      <div className="card divide-y divide-slate-100 p-0">
        {/* Email */}
        <form onSubmit={saveEmail} className="space-y-3 p-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email/Username</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          {emailMsg && (
            <p className={`text-sm ${emailMsg.ok ? "text-green-700" : "text-red-600"}`}>
              {emailMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={emailBusy || email === session.email}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {emailBusy ? "Saving…" : "Update email"}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={savePassword} className="space-y-3 p-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Current password</span>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">New password</span>
              <input
                type="password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Confirm new password</span>
              <input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                required
                minLength={8}
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}>
              {pwMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pwBusy ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Admin management (superadmin only) ────────────────────────────────── */

function AdminsSection({ currentId }: { currentId: string }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [form, setForm] = useState({ email: "", password: "", role: "admin" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/admins")
      .then((r) => r.json())
      .then((d) => setAdmins(d.admins ?? []))
      .catch(() => setAdmins([]));
  }, []);

  useEffect(load, [load]);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg({ ok: true, text: `Added ${data.admin.email} as ${data.admin.role}.` });
      setForm({ email: "", password: "", role: "admin" });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(a: AdminRow) {
    if (!confirm(`Remove ${a.email}? They will lose access immediately.`)) return;
    const res = await fetch(`/api/admin/admins?id=${a.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const d = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: d.error ?? "Failed to remove" });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Admin accounts</h2>
        <p className="text-sm text-slate-500">Manage who can access the admin portal.</p>
      </div>

      {/* Table + form side-by-side */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Account list — 2/3 width */}
        <div className="card overflow-hidden p-0 lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">
                      {a.email}
                      {a.id === currentId && (
                        <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          a.role === "superadmin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 text-right">
                      {a.role === "admin" && a.id !== currentId && (
                        <button
                          onClick={() => removeAdmin(a)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add admin form — 1/3 width */}
        <form onSubmit={addAdmin} className="card space-y-3 p-5">
          <h3 className="text-sm font-semibold">Add new admin</h3>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              placeholder="admin@example.com"
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          {msg && (
            <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add admin"}
          </button>
        </form>
      </div>
    </div>
  );
}
