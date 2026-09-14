"use client";

import Link from "next/link";
import { useApiData } from "@/lib/use-api-data";
import { useAccountFilter } from "@/components/account-context";

export default function AccountHealth() {
  const selection = useAccountFilter();
  const { data, error, loading, refresh } = useApiData<{
    workerHealthy: boolean;
    checkedAt: string;
    accounts: {
      id: string;
      username: string;
      state: string;
      webhookSubscribed: boolean;
    }[];
  }>(selection.ready ? "/api/dashboard/health" : null, 60000);
  const accounts =
    data?.accounts.filter(
      (a) => selection.account === "all" || a.id === selection.account,
    ) ?? [];
  return (
    <section
      aria-label="Delivery health"
      className="rounded-xl border border-border p-4 text-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Delivery health</h2>
        <span className="text-muted">
          {loading
            ? "Checking…"
            : data
              ? `Checked ${new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Unavailable"}
        </span>
      </div>
      {error ? (
        <button
          onClick={refresh}
          className="mt-2 min-h-11 text-error underline"
        >
          Couldn’t check status. Try again
        </button>
      ) : (
        data && (
          <>
            <p
              className={`mt-2 ${data.workerHealthy ? "text-success" : "text-error"}`}
            >
              {data.workerHealthy
                ? "DM worker is running"
                : "Worker heartbeat unavailable — check system status"}
            </p>
            {accounts.map((account) => (
              <div
                key={account.id}
                className="mt-2 flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  @{account.username} ·{" "}
                  {account.state === "reconnect"
                    ? "Reconnect required"
                    : account.state === "verified"
                      ? "Instagram access verified"
                      : "Instagram check unavailable"}
                  {account.state === "verified" && !account.webhookSubscribed
                    ? " · Webhook not subscribed"
                    : ""}
                </span>
                {account.state !== "verified" && (
                  <Link
                    href="/settings"
                    className="inline-flex min-h-11 items-center font-medium underline"
                  >
                    {account.state === "reconnect"
                      ? "Reconnect"
                      : "Check connection"}
                  </Link>
                )}
              </div>
            ))}
            {data.accounts.length === 0 && (
              <Link
                href="/settings"
                className="inline-flex min-h-11 items-center underline"
              >
                Connect Instagram
              </Link>
            )}
            {!data.workerHealthy && (
              <Link
                href="/diagnostics"
                className="inline-flex min-h-11 items-center underline"
              >
                Open diagnostics
              </Link>
            )}
          </>
        )
      )}
    </section>
  );
}
