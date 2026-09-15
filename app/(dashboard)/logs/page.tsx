"use client";

/**
 * DM Logs Page
 *
 * Filterable, paginated table of DM logs.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccountFilter, updateQuery } from "@/components/account-context";
import { useApiData } from "@/lib/use-api-data";
import DataFeedback from "@/components/data-feedback";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";
import { formatMalaysiaDateTime } from "@/lib/malaysia-time";

interface DmLog {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  automation: { id: string; name: string; keywords: string[] };
  instagramAccount: { username: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  "ALL",
  "SENT",
  "FAILED",
  "PENDING",
  "SKIPPED_RATE_LIMIT",
  "SKIPPED_PLAN_LIMIT",
  "SKIPPED_DEDUP",
];

export default function LogsPage() {
  const selection = useAccountFilter();
  const filters = useSearchParams();
  const statusFilter = filters.get("status") ?? "ALL";
  const page = Math.max(1, Number.parseInt(filters.get("page") ?? "1") || 1);
  const automationId = filters.get("automationId");
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    instagramAccountId: selection.account,
  });
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (automationId) params.set("automationId", automationId);
  const result = useApiData<{ logs: DmLog[]; pagination: Pagination }>(
    selection.ready ? `/api/logs?${params}` : null,
    60000,
  );
  const accounts = useApiData<{ instagramAccounts: AccountOption[] }>(
    "/api/instagram/accounts",
  );
  const logs = result.data?.logs ?? [];
  const pagination = result.data?.pagination;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <AccountSelect
          accounts={accounts.data?.instagramAccounts ?? []}
          value={selection.account}
          onChange={(id) => {
            selection.select(id);
            updateQuery({ automationId: null, page: null });
          }}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span>Delivery status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              updateQuery({ status: event.target.value, page: null })
            }
            className="min-h-11 rounded-lg border border-border bg-background px-3"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "ALL"
                  ? "All statuses"
                  : status.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      {automationId && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>Activity for one campaign</p>
          <button
            onClick={() => updateQuery({ automationId: null, page: null })}
            className="min-h-11 underline"
          >
            Show all campaigns
          </button>
        </div>
      )}
      <DataFeedback {...result} />
      {!result.data && result.loading && (
        <div
          role="status"
          aria-label="Loading activity"
          className="panel h-28 rounded-xl"
        />
      )}
      {result.data && !logs.length && (
        <p className="py-8 text-muted">No activity matches these filters.</p>
      )}
      <div className="space-y-3 md:hidden">
        {logs.map((log) => (
          <article key={log.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-all font-medium">
                @{log.commenterName ?? log.commenterId.slice(0, 8)}
              </p>
              <StatusBadge status={log.status} />
            </div>
            <p className="mt-2 break-words text-base">{log.commentText}</p>
            <Link
              href={`/campaigns/${log.automation.id}`}
              className="mt-2 inline-flex min-h-11 items-center break-words text-sm underline"
            >
              {log.automation.name}
            </Link>
            <p className="text-sm text-muted">
              @{log.instagramAccount.username} ·{" "}
              {formatMalaysiaDateTime(log.createdAt)}
            </p>
            {log.errorMessage && (
              <details className="mt-2 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center text-error">
                  Why delivery failed
                </summary>
                <p className="break-words rounded-lg bg-surface p-3">
                  {log.errorMessage}
                </p>
              </details>
            )}
          </article>
        ))}
      </div>
      {logs.length > 0 && (
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  "Commenter",
                  "Comment",
                  "Campaign",
                  "Account",
                  "Status",
                  "Time",
                ].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-3">
                    @{log.commenterName ?? log.commenterId.slice(0, 8)}
                  </td>
                  <td className="max-w-xs p-3">
                    <p className="break-words">{log.commentText}</p>
                    {log.errorMessage && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-error">
                          Failure details
                        </summary>
                        <p className="break-words">{log.errorMessage}</p>
                      </details>
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/campaigns/${log.automation.id}`}
                      className="underline"
                    >
                      {log.automation.name}
                    </Link>
                  </td>
                  <td className="p-3">@{log.instagramAccount.username}</td>
                  <td className="p-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="p-3">
                    {formatMalaysiaDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && pagination.totalPages > 1 && (
        <nav
          aria-label="Activity pages"
          className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background py-3"
        >
          <button
            disabled={page <= 1 || result.loading}
            onClick={() => updateQuery({ page: String(page - 1) })}
            className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            {page} / {pagination.totalPages}
          </span>
          <button
            disabled={page >= pagination.totalPages || result.loading}
            onClick={() => updateQuery({ page: String(page + 1) })}
            className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
