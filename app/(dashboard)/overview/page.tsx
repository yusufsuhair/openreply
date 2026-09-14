"use client";

/**
 * Instagram Overview Page
 *
 * Aggregate reach/engagement across your recent posts, plus a per-post table.
 * Views / reach / saved / shares come from Instagram media insights (requires
 * the insights permission); likes and comments are always available.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccountFilter, updateQuery } from "@/components/account-context";
import { useApiData } from "@/lib/use-api-data";
import DataFeedback from "@/components/data-feedback";
import AccountSelect from "@/components/account-select";
import StatCard from "@/components/stat-card";
import FollowerChart from "@/components/follower-chart";
import type { OverviewResponse } from "@/app/api/instagram/overview/route";

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const COUNT_OPTIONS = [
  { value: "25", label: "Last 25" },
  { value: "50", label: "Last 50" },
  { value: "100", label: "Last 100" },
  { value: "all", label: "All time" },
];

export default function OverviewPage() {
  const selection = useAccountFilter();
  const params = useSearchParams();
  const accountResult = useApiData<{
    instagramAccounts: { id: string; username: string; instagramId: string }[];
  }>("/api/instagram/accounts");
  const accounts = accountResult.data?.instagramAccounts ?? [];
  const accountId = accounts.some((a) => a.id === selection.account)
    ? selection.account
    : accounts[0]?.id;
  const count = COUNT_OPTIONS.some((o) => o.value === params.get("count"))
    ? params.get("count")!
    : "25";
  const result = useApiData<OverviewResponse>(
    selection.ready && accountId
      ? `/api/instagram/overview?instagramAccountId=${encodeURIComponent(accountId)}&count=${count}`
      : null,
    30000,
  );
  const data = result.data;
  const [visible, setVisible] = useState(10);
  const posts = data?.posts ?? [];
  function changeAccount(id: string) {
    selection.select(id);
    setVisible(10);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AccountSelect
          accounts={accounts}
          includeAll={false}
          value={accountId ?? ""}
          onChange={changeAccount}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span>Post range</span>
          <select
            value={count}
            onChange={(event) => {
              updateQuery({ count: event.target.value });
              setVisible(10);
            }}
            className="min-h-11 rounded-lg border border-border bg-background px-3"
          >
            {COUNT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {accountResult.error && <DataFeedback {...accountResult} />}
      {accountResult.data && !accounts.length ? (
        <div className="panel rounded-xl p-5">
          <p>Connect Instagram to view analytics.</p>
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center underline"
          >
            Open Settings
          </Link>
        </div>
      ) : (
        <DataFeedback
          {...result}
          updatedAt={
            data?.updatedAt ? Date.parse(data.updatedAt) : result.updatedAt
          }
          error={
            result.error ||
            (data?.refreshError ? new Error(data.refreshError) : null)
          }
        />
      )}
      {(result.error?.message.includes("Reconnect") ||
        data?.refreshError?.includes("Reconnect")) && (
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center underline"
        >
          Reconnect Instagram
        </Link>
      )}
      {!data && result.loading && accountId && (
        <div
          role="status"
          className="panel h-28 rounded-xl"
          aria-label="Loading analytics"
        />
      )}
      {data && (
        <>
          <p className="text-sm text-muted">
            {posts.length} posts from @{data.account.username}
            {data.truncated ? " (limited to 500 posts)" : ""}
            {data.refreshing ? " · Updating Instagram snapshot…" : ""}
          </p>
          {!data.insightsAvailable && (
            <div className="panel rounded-xl p-4">
              <p className="text-sm">
                Some insights are unavailable. Likes and comments are still
                shown.
              </p>
              <Link
                href="/settings"
                className="inline-flex min-h-11 items-center text-sm underline"
              >
                Check Instagram permissions
              </Link>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Views" value={formatNumber(data.totals.views)} />
            <StatCard label="Reach" value={formatNumber(data.totals.reach)} />
            <StatCard label="Likes" value={formatNumber(data.totals.likes)} />
            <StatCard
              label="Comments"
              value={formatNumber(data.totals.comments)}
            />
            <StatCard label="Saved" value={formatNumber(data.totals.saved)} />
            <StatCard label="Shares" value={formatNumber(data.totals.shares)} />
          </div>
          <FollowerChart
            data={data.followerHistory}
            followers={data.followers}
          />
          <section aria-label="Post performance" className="space-y-3">
            <h2 className="text-lg font-semibold">Posts</h2>
            {posts.length === 0 && (
              <p className="text-muted">No posts found.</p>
            )}
            <div className="space-y-3 md:hidden">
              {posts.slice(0, visible).map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-border p-4"
                >
                  <p className="mb-2 text-sm text-muted">
                    {formatDate(post.timestamp)} · {post.mediaType}
                  </p>
                  {post.permalink ? (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-words text-base font-medium underline underline-offset-4"
                    >
                      {post.caption || "Open post"}
                    </a>
                  ) : (
                    <p>{post.caption || "Post"}</p>
                  )}
                  <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    {[
                      ["Views", post.views],
                      ["Reach", post.reach],
                      ["Comments", post.comments],
                      ["Likes", post.likes],
                      ["Saved", post.saved],
                      ["Shares", post.shares],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted">{label}</dt>
                        <dd className="font-semibold tabular-nums">
                          {formatNumber(value as number | null)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-3">Post</th>
                    {[
                      "Views",
                      "Reach",
                      "Likes",
                      "Comments",
                      "Saved",
                      "Shares",
                      "Date",
                    ].map((label) => (
                      <th key={label} className="p-3 text-right">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posts.slice(0, visible).map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="max-w-xs p-3">
                        {post.permalink ? (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-2 underline"
                          >
                            {post.caption || "Open post"}
                          </a>
                        ) : (
                          post.caption
                        )}
                      </td>
                      {[
                        post.views,
                        post.reach,
                        post.likes,
                        post.comments,
                        post.saved,
                        post.shares,
                      ].map((value, i) => (
                        <td key={i} className="p-3 text-right tabular-nums">
                          {formatNumber(value)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap p-3 text-right">
                        {formatDate(post.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible < posts.length && (
              <button
                onClick={() => setVisible((n) => n + 10)}
                className="min-h-11 w-full rounded-lg border border-border px-4 text-sm"
              >
                Show 10 more posts ({Math.min(visible, posts.length)} of{" "}
                {posts.length})
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
