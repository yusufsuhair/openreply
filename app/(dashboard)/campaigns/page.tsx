"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/remembered-link";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { useAccountFilter, updateQuery } from "@/components/account-context";
import {
  useApiData,
  requestData,
  invalidateApiCache,
} from "@/lib/use-api-data";
import DataFeedback from "@/components/data-feedback";
import AccountHealth from "@/components/account-health";
import VideoDialog from "@/components/video-dialog";
import { readCache, writeCache } from "@/lib/client-cache";

interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  isActive: boolean;
  wholeWordMatch: boolean;
  instagramAccountId: string;
  instagramAccount: {
    username: string;
    instagramId: string;
  };
  reportShareSlug: string | null;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  createdAt: string;
  _count: { dmLogs: number };
  trackedLinks: Array<{
    id: string;
    slug: string;
    label: string | null;
    destinationUrl: string;
    trackedUrl: string;
    _count: { clicks: number };
  }>;
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
    topKeywords: { keyword: string; count: number }[];
  };
}

export default function CampaignsPage() {
  const selection = useAccountFilter();
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? "all";
  const query = new URLSearchParams({ instagramAccountId: selection.account });
  const result = useApiData<Campaign[]>(
    selection.ready ? `/api/automations?${query}` : null,
    60000,
  );
  const accountsResult = useApiData<{ instagramAccounts: AccountOption[] }>(
    "/api/instagram/accounts",
  );
  const automations = result.data;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
  } | null>(null);
  const [media, setMedia] = useState<
    Record<string, { thumbnail: string; video?: string }>
  >({});
  const accountIds = Array.from(
    new Set(automations?.map((a) => a.instagramAccountId) ?? []),
  )
    .sort()
    .join(",");
  useEffect(() => {
    if (!accountIds) return;
    const controller = new AbortController();
    const key = `ig-media-compact:${selection.scope}:${accountIds}`;
    const timer = setTimeout(async () => {
      const cached = readCache<typeof media>(key, 15 * 60000);
      if (cached.data) setMedia(cached.data);
      if (cached.data && !cached.stale) return;
      try {
        const lists = await Promise.all(
          accountIds.split(",").map((id) =>
            requestData<
              {
                id: string;
                media_type: string;
                thumbnail_url?: string;
                media_url?: string;
              }[]
            >(
              `/api/instagram/posts?instagramAccountId=${encodeURIComponent(id)}&limit=50`,
              { signal: controller.signal },
            ).catch(() => []),
          ),
        );
        if (controller.signal.aborted) return;
        const next: typeof media = {};
        for (const item of lists.flat())
          next[item.id] = {
            thumbnail: item.thumbnail_url ?? item.media_url ?? "",
            video: item.media_type === "VIDEO" ? item.media_url : undefined,
          };
        setMedia(next);
        writeCache(key, next);
      } catch {
        /* Campaigns remain usable when Instagram media is unavailable. */
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accountIds, selection.scope]);

  async function toggleActive(auto: Campaign) {
    if (busyId) return;
    setBusyId(auto.id);
    setActionError(null);
    try {
      await requestData(`/api/automations?id=${auto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !auto.isActive }),
      });
      invalidateApiCache();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update campaign",
      );
    } finally {
      setBusyId(null);
    }
  }
  async function deleteAutomation(id: string) {
    if (
      busyId ||
      !confirm("Delete this campaign and its activity? This cannot be undone.")
    )
      return;
    setBusyId(id);
    setActionError(null);
    try {
      await requestData(`/api/automations?id=${id}`, { method: "DELETE" });
      invalidateApiCache();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete campaign",
      );
    } finally {
      setBusyId(null);
    }
  }
  async function copyReelUrl(auto: Campaign) {
    try {
      await navigator.clipboard.writeText(auto.postUrl ?? "");
      setCopiedId(auto.id);
    } catch {
      setActionError("Could not copy. Open the campaign to copy its URL.");
    }
  }
  async function duplicateAutomation(auto: Campaign) {
    setBusyId(auto.id);
    setActionError(null);
    const specific = !auto.matchAnyPost && !auto.pendingNextReel;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${auto.name} copy`,
          instagramAccountId: auto.instagramAccountId,
          postId: specific ? auto.postId : null,
          postUrl: specific ? auto.postUrl : null,
          matchAnyPost: auto.matchAnyPost,
          pendingNextReel: auto.pendingNextReel,
          matchAnyWord: auto.matchAnyWord,
          keywords: auto.keywords,
          dmMessage: auto.dmMessage,
          openingDmEnabled: auto.openingDmEnabled,
          openingDmMessage: auto.openingDmMessage,
          openingDmButtonLabel: auto.openingDmButtonLabel,
          publicReplyEnabled: auto.publicReplyEnabled,
          publicReplyMessages: auto.publicReplyMessages,
          trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
          secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
          secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Open link",
          requireFollow: auto.requireFollow,
          followPromptMessage: auto.followPromptMessage,
          followPromptButtonLabel: auto.followPromptButtonLabel,
          wholeWordMatch: auto.wholeWordMatch,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "Could not duplicate campaign");
      invalidateApiCache();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not duplicate campaign",
      );
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (automations ?? []).filter(
    (auto) =>
      (statusFilter !== "active" || auto.isActive) &&
      (statusFilter !== "paused" || !auto.isActive) &&
      (statusFilter !== "failed" || auto.analytics.failed > 0) &&
      [auto.name, auto.dmMessage, ...auto.keywords].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AccountSelect
          accounts={accountsResult.data?.instagramAccounts ?? []}
          value={selection.account}
          onChange={selection.select}
        />
        <Link
          href="/campaigns/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          New campaign
        </Link>
      </div>
      <AccountHealth compact />
      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background py-3">
        <label className="block">
          <span className="sr-only">Search campaigns</span>
          <input
            value={search}
            onChange={(event) => updateQuery({ q: event.target.value })}
            placeholder="Find a campaign or keyword"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["all", "All"],
            ["active", "Enabled"],
            ["paused", "Paused"],
            ["failed", "With failures"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => updateQuery({ status: value })}
              className={`min-h-11 rounded-lg border px-3 text-sm ${statusFilter === value ? "border-foreground bg-foreground text-background" : "border-border text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <DataFeedback {...result} />
      {accountsResult.error && (
        <p role="alert" className="text-sm text-error">
          Account selector unavailable.{" "}
          <button onClick={accountsResult.refresh} className="underline">
            Retry
          </button>
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-error/30 p-3 text-sm text-error"
        >
          {actionError}
        </p>
      )}
      {!automations && result.loading && (
        <div
          role="status"
          className="panel h-28 rounded-xl"
          aria-label="Loading campaigns"
        />
      )}
      {automations && (
        <p className="text-sm text-muted">
          {filtered.length} of {automations.length} campaigns · Lifetime totals
        </p>
      )}
      {automations?.length === 0 && (
        <div className="panel rounded-xl p-6">
          <h2 className="font-semibold">No campaigns yet</h2>
          <p className="mt-2 text-sm text-muted">
            Create a campaign to send a DM when someone comments.
          </p>
        </div>
      )}
      {automations && automations.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-muted">No campaigns match these filters.</p>
      )}
      <div className="space-y-3">
        {filtered.map((auto) => {
          const preview = auto.postId ? media[auto.postId] : undefined;
          const activityUrl = `/logs?automationId=${auto.id}&instagramAccountId=${auto.instagramAccountId}&status=FAILED`;
          return (
            <article
              key={auto.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex items-start gap-3">
                {preview?.thumbnail && (
                  <button
                    type="button"
                    disabled={!preview.video}
                    aria-label={`Preview reel for ${auto.name}`}
                    onClick={() =>
                      preview.video &&
                      setPlayingVideo({
                        url: preview.video,
                        postUrl: auto.postUrl,
                      })
                    }
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.thumbnail}
                      width={44}
                      height={44}
                      loading="lazy"
                      alt=""
                      className="h-11 w-11 rounded-lg object-cover"
                    />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">
                    <Link
                      href={`/campaigns/${auto.id}`}
                      className="block min-h-6 break-words hover:underline"
                    >
                      {auto.name}
                    </Link>
                  </h2>
                  <p className="mt-1 break-words text-sm text-muted">
                    @{auto.instagramAccount.username} ·{" "}
                    {auto.isActive ? "Enabled" : "Paused"}
                    {auto.pendingNextReel ? " · Waiting for next reel" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={auto.isActive}
                  aria-label={`Enable ${auto.name}`}
                  disabled={Boolean(busyId) || result.loading}
                  onClick={() => void toggleActive(auto)}
                  className="flex h-11 w-12 shrink-0 items-center justify-center disabled:opacity-50"
                >
                  <span
                    className={`flex h-6 w-11 items-center rounded-full px-1 ${auto.isActive ? "justify-end bg-accent" : "justify-start bg-muted"}`}
                  >
                    <span className="h-4 w-4 rounded-full bg-white" />
                  </span>
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm tabular-nums">
                <p>
                  <strong className="block text-lg">
                    {auto.analytics.sent.toLocaleString()}
                  </strong>
                  <span className="text-muted">Sent</span>
                </p>
                <p>
                  <strong className="block text-lg">
                    {auto.analytics.clicks.toLocaleString()}
                  </strong>
                  <span className="text-muted">
                    Clicks · {auto.analytics.ctr}%
                  </span>
                </p>
                <Link
                  href={activityUrl}
                  className={`min-h-11 ${auto.analytics.failed ? "text-error" : "text-muted"}`}
                >
                  <strong className="block text-lg">
                    {auto.analytics.failed.toLocaleString()}
                  </strong>
                  <span className="underline">Failed</span>
                </Link>
              </div>
              <details className="mt-2 border-t border-border pt-1">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">
                  Details & actions
                </summary>
                <div className="space-y-3 pb-1">
                  <p className="break-words text-sm">
                    <span className="font-medium">Keywords:</span>{" "}
                    {auto.keywords.join(", ") || "Any comment"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted">
                    {auto.dmMessage}
                  </p>
                  {auto.trackedLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.trackedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-sm underline"
                    >
                      {link.trackedUrl}
                    </a>
                  ))}
                  <p className="text-sm text-muted">
                    {auto._count.dmLogs} runs · {auto.analytics.skipped} skipped
                    {auto.requireFollow ? " · Follow gate" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/campaigns/${auto.id}/edit`}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm"
                    >
                      Edit
                    </Link>
                    {auto.postUrl && (
                      <button
                        onClick={() => void copyReelUrl(auto)}
                        className="min-h-11 rounded-lg border border-border px-3 text-sm"
                      >
                        {copiedId === auto.id ? "Copied" : "Copy post URL"}
                      </button>
                    )}
                    <button
                      disabled={Boolean(busyId)}
                      onClick={() => void duplicateAutomation(auto)}
                      className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={Boolean(busyId)}
                      onClick={() => void deleteAutomation(auto.id)}
                      className="min-h-11 rounded-lg border border-error/30 px-3 text-sm text-error disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <Link
        href="/campaigns/import"
        className="inline-flex min-h-11 items-center px-2 text-sm underline"
      >
        Import campaigns
      </Link>
      <VideoDialog video={playingVideo} close={() => setPlayingVideo(null)} />
    </div>
  );
}
