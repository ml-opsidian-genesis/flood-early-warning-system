"use client";

import { useMemo, useState } from "react";
import type { LocationScore } from "./types";
import { RISK_COLORS, type RiskLevel } from "@/lib/risk";

type Props = {
  locations: LocationScore[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSetSelected: (ids: string[]) => void;
};

type Step = "phone" | "otp" | "ready" | "done";

export default function SubscribePanel({ locations, selectedIds, onToggle, onSetSelected }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState("");

  const selected = useMemo(
    () => locations.filter((l) => selectedIds.has(l.id)),
    [locations, selectedIds],
  );

  function reset() {
    setStep("phone");
    setPhone("");
    setCode("");
    setToken("");
    setError(null);
    setNote(null);
    onSetSelected([]);
  }

  async function sendCode() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/manage/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send code");
      setStep("otp");
      setNote(data.simulated ? "Simulation mode: use code 123456." : "We sent a code to your phone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/manage/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setToken(data.token);
      // Pre-select existing subscriptions on the map (merged with any picks).
      const existing: string[] = data.locationIds ?? [];
      onSetSelected(Array.from(new Set([...selectedIds, ...existing])));
      setStep("ready");
      setNote(
        existing.length
          ? `Your current alerts (${existing.length}) are selected on the map. Adjust and save.`
          : "Pick locations on the map, then save.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function save(locationIds: string[], unsubAll = false) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/manage/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, locationIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      if (unsubAll) onSetSelected([]);
      setDoneMsg(
        data.count === 0
          ? "You've been unsubscribed from all alerts."
          : `Done — you'll get WhatsApp alerts for ${data.count} location${data.count > 1 ? "s" : ""}.`,
      );
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">
          {step === "ready" || step === "done" ? "Manage your alerts" : "Subscribe to flood alerts"}
        </h2>
        <p className="text-sm text-slate-500">
          Verify your number, pick locations on the map, and get a WhatsApp alert whenever a place
          you follow crosses the high-risk threshold. No account needed.
        </p>
      </div>

      {/* Current map selection */}
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Selected ({selected.length})
        </div>
        {selected.length === 0 ? (
          <p className="text-sm text-slate-400">None yet — click markers on the map.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((l) => (
              <button
                key={l.id}
                onClick={() => onToggle(l.id)}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs hover:bg-slate-100"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: l.riskLevel ? RISK_COLORS[l.riskLevel as RiskLevel] : "#94a3b8" }}
                />
                {l.name}
                <span className="text-slate-400">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {step === "phone" && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">WhatsApp number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94771234567"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={sendCode}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send verification code"}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Enter the code sent to {phone}</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={verify}
              disabled={busy}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button onClick={reset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "ready" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-700">✓ Verified as {phone}</p>
          <button
            onClick={() => save(selected.map((l) => l.id))}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : `Save my alerts (${selected.length})`}
          </button>
          <button
            onClick={() => save([], true)}
            disabled={busy}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Unsubscribe from all
          </button>
          <button onClick={reset} className="text-xs text-slate-500 hover:underline">
            Use a different number
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          ✅ {doneMsg}
          <button onClick={reset} className="mt-2 block text-blue-600 underline">
            Manage another number
          </button>
        </div>
      )}

      {note && step !== "done" && <p className="text-xs text-slate-500">{note}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
