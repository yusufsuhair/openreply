"use client";

import Link from "@/components/remembered-link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCacheScope } from "@/components/account-context";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceName: string;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function DashboardShell({
  children,
  workspaceName,
  instagramUsername,
  instagramAccountCount,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const pathname = usePathname();
  const params = useSearchParams();
  const scope = useCacheScope();
  const main = useRef<HTMLElement>(null);
  const scrollKey = `${scope}:scroll:${pathname}?${params.toString()}`;
  useEffect(() => {
    const node = main.current;
    if (!node) return;
    try {
      sessionStorage.setItem(
        `${scope}:route:${pathname}`,
        `${pathname}${params.size ? `?${params}` : ""}`,
      );
    } catch {}
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(scrollKey)) || 0;
    } catch {}
    node.scrollTop = saved;
    let restoring = true;
    const restore = new ResizeObserver(() => {
      if (restoring) node.scrollTop = saved;
    });
    if (node.firstElementChild) restore.observe(node.firstElementChild);
    const stop = () => {
      restoring = false;
      restore.disconnect();
    };
    node.addEventListener("pointerdown", stop, { once: true });
    node.addEventListener("wheel", stop, { once: true });
    node.addEventListener("keydown", stop, { once: true });
    const timeout = setTimeout(stop, 5000);
    return () => {
      try {
        sessionStorage.setItem(scrollKey, String(node.scrollTop));
      } catch {}
      clearTimeout(timeout);
      restore.disconnect();
      node.removeEventListener("pointerdown", stop);
      node.removeEventListener("wheel", stop);
      node.removeEventListener("keydown", stop);
    };
  }, [scrollKey, scope, pathname, params]);

  return (
    // h-dvh, not h-screen: on mobile browsers the URL bar eats into 100vh, which
    // would push the composer and pagination controls below the fold.
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        workspaceName={workspaceName}
      />

      <div
        inert={sidebarOpen || undefined}
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3">
          Skip to content
        </a>
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          instagramUsername={instagramUsername}
          instagramAccountCount={instagramAccountCount}
        />

        {/* overflow-x-hidden: enabling vertical scrolling makes the browser
            allow horizontal scrolling too, which lets a wide child drag the
            whole page sideways on a phone. */}
        <main
          id="main-content"
          ref={main}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="px-4 lg:px-8 py-5 sm:py-6 max-w-7xl mx-auto pb-8">
            {children}
          </div>
        </main>
        <nav
          aria-label="Quick navigation"
          className="grid shrink-0 grid-cols-5 border-t border-border bg-background px-1 lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {[
            ["Home", "/dashboard"],
            ["Campaigns", "/campaigns"],
            ["Inbox", "/inbox"],
            ["Activity", "/logs"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                pathname === href || pathname.startsWith(href + "/")
                  ? "page"
                  : undefined
              }
              className={`flex min-h-14 items-center justify-center rounded-lg text-xs font-medium ${pathname === href || pathname.startsWith(href + "/") ? "bg-surface-hover text-foreground" : "text-muted"}`}
            >
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="min-h-14 text-xs font-medium text-muted"
          >
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
