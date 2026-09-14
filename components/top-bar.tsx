"use client";

/**
 * Top Bar
 *
 * Page title, mobile hamburger, and connection status.
 */

import Link from "@/components/remembered-link";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/overview": "Analytics",
  "/inbox": "Inbox",
  "/campaigns/import": "Import campaigns",
  "/campaigns": "Campaigns",
  "/campaigns/new": "New Campaign",
  "/automations": "Campaigns",
  "/automations/new": "New Campaign",
  "/logs": "Activity",
  "/settings": "Settings",
  "/diagnostics": "Diagnostics",
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const isCampaign =
    /^\/campaigns\/[^/]+/.test(pathname) &&
    !["/campaigns/new", "/campaigns/import"].includes(pathname);
  const title =
    pageTitles[pathname] ??
    (isCampaign
      ? pathname.endsWith("/edit")
        ? "Edit campaign"
        : "Campaign details"
      : "OpenReply");

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-border bg-background"
      // Installed to the home screen the app starts at the very top of the
      // display, so without this the title sits under the clock and battery.
      // The inset is 0 in a browser tab and on desktop.
      style={{
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden min-h-11 shrink-0 px-2.5 py-1.5 rounded border border-border text-sm text-muted hover:text-foreground"
          aria-label="Open navigation"
        >
          Menu
        </button>
        <div className="min-w-0">
          {isCampaign && (
            <Link
              href="/campaigns"
              className="inline-flex min-h-8 items-center text-sm text-muted underline underline-offset-4"
            >
              Back to campaigns
            </Link>
          )}
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {title}
          </h1>
        </div>
      </div>

      {instagramAccountCount > 0 ? (
        <p className="shrink-0 truncate text-sm text-muted">
          {instagramAccountCount > 1
            ? `${instagramAccountCount} accounts`
            : `@${instagramUsername}`}
        </p>
      ) : (
        <a
          href="/api/instagram/connect"
          className="shrink-0 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
        >
          {/* Full label needs more room than a 360px header has to spare. */}
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect Instagram</span>
        </a>
      )}
    </header>
  );
}
