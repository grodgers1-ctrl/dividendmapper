"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Account "Connected brokers" UI. Pro-gated. Renders a status card per live
// connection (last synced, "Sync now", disconnect) plus a connect form to add
// another account, until both T212 wrappers (ISA + Invest) are connected. A
// user can hold several connections; each action targets ONE connection by id.
// All actions hit the /api/portfolio/broker/* routes; the credential only ever
// travels up to the connect endpoint and is never returned.

export type BrokerStatus = "active" | "error" | "revoked";

type T212Wrapper = "isa" | "gia";

export interface BrokerConnectionState {
  id: string;
  provider: "trading212";
  wrapper: "isa" | "gia" | null;
  status: BrokerStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

const WRAPPER_LABEL: Record<T212Wrapper, string> = {
  isa: "Stocks & Shares ISA",
  gia: "Invest (general account)",
};

const ALL_T212_WRAPPERS: T212Wrapper[] = ["isa", "gia"];

function formatSynced(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not synced yet";
  return `Last synced ${d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function BrokerConnection({
  isPro,
  connections,
}: {
  isPro: boolean;
  connections: BrokerConnectionState[];
}) {
  const router = useRouter();

  if (!isPro) {
    return (
      <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
        <p className="text-foreground">Broker sync is a Pro feature.</p>
        <Link
          href="/pricing"
          className="mt-2 inline-block font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          Upgrade to connect your broker
        </Link>
      </div>
    );
  }

  const active = connections.filter((c) => c.status !== "revoked");
  const taken = new Set(active.map((c) => c.wrapper).filter(Boolean) as T212Wrapper[]);
  const available = ALL_T212_WRAPPERS.filter((w) => !taken.has(w));

  return (
    <div className="space-y-6">
      {active.map((conn) => (
        <ConnectedCard key={conn.id} initial={conn} onChange={() => router.refresh()} />
      ))}

      {available.length > 0 ? (
        <ConnectForm
          availableWrappers={available}
          hasExisting={active.length > 0}
          onConnected={() => router.refresh()}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Both your Trading 212 accounts (ISA and Invest) are connected.
        </p>
      )}
    </div>
  );
}

function ConnectForm({
  availableWrappers,
  hasExisting,
  onConnected,
}: {
  availableWrappers: T212Wrapper[];
  hasExisting: boolean;
  onConnected: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [wrapper, setWrapper] = useState<T212Wrapper>(availableWrappers[0]);
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setStatus("connecting");
    setError(null);
    try {
      const res = await fetch("/api/portfolio/broker/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), wrapper }),
      });
      if (res.ok) {
        onConnected();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(
        body.error === "invalid_credentials"
          ? "Those keys didn't work. Check you copied both values and that the key is read-only."
          : "Couldn't connect. Try again in a moment.",
      );
    } catch {
      setStatus("error");
      setError("Network error. Check your connection and try again.");
    }
  }

  const canSubmit = apiKey.trim() !== "" && apiSecret.trim() !== "" && status !== "connecting";

  return (
    <div className="space-y-4">
      {hasExisting && (
        <h3 className="font-display text-sm font-semibold text-foreground">Add another account</h3>
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {hasExisting
          ? "Got an ISA and an Invest account? Each has its own API key. Add the other one here."
          : "Connect Trading 212 to pull your holdings and your real paid dividends. Your income view then reflects what you actually received, not an estimate."}
      </p>

      <div>
        <label htmlFor="broker-wrapper" className="text-sm font-medium text-foreground">
          Which account is this?
        </label>
        <select
          id="broker-wrapper"
          value={wrapper}
          onChange={(e) => setWrapper(e.target.value as T212Wrapper)}
          className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          {availableWrappers.map((w) => (
            <option key={w} value={w}>
              {WRAPPER_LABEL[w]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          One API key covers one account, so pick the one this key belongs to.
        </p>
      </div>

      <div>
        <label htmlFor="broker-key" className="text-sm font-medium text-foreground">
          API key
        </label>
        <input
          id="broker-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground"
        />
      </div>

      <div>
        <label htmlFor="broker-secret" className="text-sm font-medium text-foreground">
          API secret
        </label>
        <input
          id="broker-secret"
          type="password"
          autoComplete="off"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm text-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          In the Trading 212 app: Settings → API (Beta). Generate a key and paste both values here.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          The Trading 212 API is read-only, so we can read your holdings but can never place a trade.
          We encrypt your key before storing it, never show it again, and you can disconnect whenever
          you want.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={connect}
        disabled={!canSubmit}
        className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {status === "connecting" ? "Connecting" : "Connect Trading 212"}
      </button>
    </div>
  );
}

function ConnectedCard({
  initial,
  onChange,
}: {
  initial: BrokerConnectionState;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<"idle" | "syncing" | "disconnecting">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(initial.status === "error" ? initial.lastSyncError : null);

  async function syncNow() {
    setBusy("syncing");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/portfolio/broker/sync", {
        method: "POST",
        body: JSON.stringify({ connectionId: initial.id }),
      });
      if (res.ok) {
        onChange();
        return;
      }
      setBusy("idle");
      setErr("Sync failed. Try again in a moment.");
    } catch {
      setBusy("idle");
      setErr("Network error. Check your connection and try again.");
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Trading 212? Your synced holdings stay, but they stop updating.")) {
      return;
    }
    setBusy("disconnecting");
    setErr(null);
    try {
      const res = await fetch("/api/portfolio/broker/connect", {
        method: "DELETE",
        body: JSON.stringify({ connectionId: initial.id }),
      });
      if (res.ok || res.status === 404) {
        onChange();
        return;
      }
      setBusy("idle");
      setErr("Couldn't disconnect. Try again in a moment.");
    } catch {
      setBusy("idle");
      setErr("Network error. Check your connection and try again.");
    }
  }

  const wrapperLabel = initial.wrapper ? WRAPPER_LABEL[initial.wrapper] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold text-foreground">Trading 212</span>
          {wrapperLabel && (
            <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
              {wrapperLabel}
            </span>
          )}
          {initial.status === "error" && (
            <span className="inline-flex items-center rounded-full border border-negative/30 bg-negative/10 px-2 py-0.5 text-xs font-medium text-negative">
              Last sync failed
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{formatSynced(initial.lastSyncedAt)}</p>
      </div>

      {err && (
        <p role="alert" className="text-sm text-negative">
          {err}
        </p>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={syncNow}
          disabled={busy !== "idle"}
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "syncing" ? "Syncing" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={disconnect}
          disabled={busy !== "idle"}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {busy === "disconnecting" ? "Disconnecting" : "Disconnect"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        A daily sync keeps this current. Use Sync now if you want an update right away.
      </p>
    </div>
  );
}
