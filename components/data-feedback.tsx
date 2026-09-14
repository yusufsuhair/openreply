"use client";

import Link from "next/link";

export default function DataFeedback({
  loading,
  error,
  updatedAt,
  refresh,
}: {
  loading: boolean;
  error?: Error | null;
  updatedAt?: number | null;
  refresh: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 text-sm"
      aria-live="polite"
      aria-busy={loading}
    >
      <p
        className={error ? "text-error" : "text-muted"}
        role={error ? "alert" : undefined}
      >
        {error
          ? `${error.message}${updatedAt ? " Showing the last saved result." : ""}`
          : loading
            ? updatedAt
              ? "Updating…"
              : "Loading…"
            : updatedAt
              ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
      </p>
      <div className="flex items-center gap-2">
        {error?.message.includes("sign in") && (
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center underline"
          >
            Sign in
          </Link>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="min-h-11 rounded-lg border border-border px-3 font-medium disabled:opacity-50"
        >
          {error ? "Try again" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
