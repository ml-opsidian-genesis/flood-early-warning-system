"use client";

import { useMemo, useState } from "react";
import type { LocationScore } from "./types";
import { riskColor } from "@/lib/risk";

type Props = {
  locations: LocationScore[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
};

type Step = "select" | "otp" | "done";

export default function SubscribePanel({ locations, selectedIds, onToggle }: Props) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => locations.filter((l) => selectedIds.has(l.id)),
    [locations, selectedIds],
  );
  const locationIds = selected.map((l) => l.id);

  async function requestOtp() {
    setError(null);
    setNote(null);
    if (locationIds.length === 0) return setError("Select at least one location on the map.");
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, locationIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send code");
      setStep("otp");
      setNote(data.simulated ? "Simulation mode: use code 123456." : "We sent a 6-digit code to your phone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, locationIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("select");
    setCode("");
    setPhone("");
    setError(null);
    setNote(null);
  }

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Subscribe to flood alerts</h2>
        <p className="text-sm text-slate-500">
          Pick locations on the map, verify your number, and get a WhatsApp alert whenever a
          place you follow crosses the high-risk threshold.
        </p>
      </div>

      {/* Selected locations */}
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
                disabled={step !== "select"}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-60"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: l.score != null ? riskColor(l.score) : "#94a3b8" }}
                />
                {l.name}
                {step === "select" && <span className="text-slate-400">×</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {step === "select" && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">WhatsApp number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+94771234567"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={requestOtp}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send verification code"}
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
              onClick={verifyOtp}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify & subscribe"}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          ✅ You&apos;re subscribed to {selected.length} location{selected.length > 1 ? "s" : ""}.
          You&apos;ll get a WhatsApp alert when any crosses the high-risk threshold.
          <button onClick={reset} className="mt-2 block text-blue-600 underline">
            Subscribe another number
          </button>
        </div>
      )}

      {note && <p className="text-xs text-slate-500">{note}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
