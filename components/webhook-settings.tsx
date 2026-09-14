"use client";

import { useState } from "react";
import { useApiData, requestData } from "@/lib/use-api-data";
import DataFeedback from "@/components/data-feedback";

type Hook = {
  url: string;
  enabled: boolean;
  deliveries: {
    id: string;
    status: string;
    attempts: number;
    httpStatus: number | null;
    error: string | null;
    createdAt: string;
  }[];
};

export default function WebhookSettings() {
  const result = useApiData<Hook>("/api/integrations/webhook", 30_000);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (result.error?.status === 403) return null;
  const saved = result.data;
  const currentUrl = url ?? saved?.url ?? "";
  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestData<{
        enabled: boolean;
        signingSecret: string | null;
      }>("/api/integrations/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, enabled }),
      });
      if (response.signingSecret) setSecret(response.signingSecret);
      setNotice(
        response.enabled
          ? "Webhook enabled for future successful DM events."
          : "Saved off. No events will be sent.",
      );
      setUrl(null);
      result.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save integration");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="integrations"
      className="space-y-4 rounded-xl border border-border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Integrations · Outgoing webhook</h2>
        <span className="text-sm">
          {saved?.enabled ? "On" : "Off by default"}
        </span>
      </div>
      <p className="text-sm text-muted">
        Connect n8n, Make or your own receiver. Save your endpoint first, then
        enable it when ready.
      </p>
      <DataFeedback {...result} />
      {saved && (
        <>
          <label className="block space-y-2 text-sm">
            <span>Public HTTPS webhook URL</span>
            <input
              type="url"
              value={currentUrl}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              placeholder="https://your-receiver.example/webhook"
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
            />
          </label>
          <p className="text-xs text-muted">
            Once enabled, shares campaign details and Instagram sender IDs after
            a successful DM delivery.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || result.loading || !currentUrl}
              onClick={() => void save(false)}
              className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-50"
            >
              Save off
            </button>
            {saved.url && currentUrl === saved.url && (
              <button
                disabled={busy || result.loading}
                onClick={() => void save(!saved.enabled)}
                className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-50"
              >
                {saved.enabled ? "Disable webhook" : "Enable webhook"}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            New or changed endpoints stay off until enabled. Only future
            deliveries are included.
          </p>
        </>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {secret && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Signing secret · copy now; shown only after configuration
          </p>
          <code className="block select-all break-all rounded-lg bg-surface-hover p-3 text-xs">
            {secret}
          </code>
          <button
            className="min-h-11 text-sm underline"
            onClick={() => setSecret(null)}
          >
            Hide secret
          </button>
        </div>
      )}
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          Receiver setup and event details
        </summary>
        <div className="space-y-3 text-xs text-muted">
          <p>
            One message.sent event per successful delivery record. Opening
            messages and follow prompts count; repeat sends that reuse a record
            do not create another event. This is not a signup or purchase event.
          </p>
          <p>
            Payload: event ID/time, campaign ID/name, account ID, Instagram
            sender ID, matched keyword and delivery log ID. Message text, email
            and access tokens are excluded.
          </p>
          <p>
            Changing the URL generates a new signing secret. Disabling cancels
            queued events; a request already in flight may finish.
          </p>
          <p>
            Verify X-OpenReply-Signature against HMAC-SHA256 of timestamp +
            &quot;.&quot; + the raw request body, using the signing secret.
            Reject old timestamps and deduplicate using X-OpenReply-Event-Id. Up
            to 3 attempts; a timeout can mean your receiver already accepted the
            event.
          </p>
        </div>
      </details>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Recent deliveries</h3>
        {saved && !saved.deliveries.length && (
          <p className="text-sm text-muted">
            No deliveries yet. Saving an endpoint does not send a test or
            activate it.
          </p>
        )}
        {saved?.deliveries.map((d) => (
          <div key={d.id} className="border-t border-border py-2 text-sm">
            <p>
              {d.status} · {d.attempts} attempts
              {d.httpStatus ? " · HTTP " + d.httpStatus : ""}
            </p>
            <p className="break-all text-xs text-muted">{d.id}</p>
            {d.error && <p className="text-xs text-error">{d.error}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
