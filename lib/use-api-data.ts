"use client";

import { useCallback, useEffect, useState } from "react";
import { useCacheScope } from "@/components/account-context";
import { readCache, writeCache } from "@/lib/client-cache";

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function requestData<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(55000)])
      : AbortSignal.timeout(55000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new RequestError(
      response.status === 401
        ? "Your session expired. Please sign in again."
        : body?.error || "Unable to load data. Please try again.",
      response.status,
    );
  }
  return body.data as T;
}

export function invalidateApiCache() {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("api:"))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {}
  window.dispatchEvent(new Event("openreply:data-changed"));
}

export function useApiData<T>(url: string | null, pollMs = 0) {
  const scope = useCacheScope();
  const key = url ? `api:${scope}:${url}` : "";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: RequestError | null;
    loading: boolean;
    updatedAt: number | null;
  }>({ key: "", data: null, error: null, loading: true, updatedAt: null });
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener("openreply:data-changed", refresh);
    return () => window.removeEventListener("openreply:data-changed", refresh);
  }, [refresh]);
  useEffect(() => {
    if (!pollMs) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, pollMs);
    return () => clearInterval(interval);
  }, [pollMs, refresh]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const cached = readCache<{ data: T; updatedAt: number }>(key, 60000);
      setState((previous) => ({
        key,
        data:
          previous.key === key ? previous.data : (cached.data?.data ?? null),
        updatedAt:
          previous.key === key
            ? previous.updatedAt
            : (cached.data?.updatedAt ?? null),
        error: null,
        loading: true,
      }));
      requestData<T>(url, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return;
          const updatedAt = Date.now();
          writeCache(key, { data, updatedAt });
          setState({ key, data, updatedAt, error: null, loading: false });
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          const failure =
            error instanceof RequestError
              ? error
              : new RequestError(
                  "Connection interrupted. Check your internet and try again.",
                  0,
                );
          setState((previous) => ({
            ...previous,
            key,
            error: failure,
            loading: false,
            ...(failure.status === 401 ||
            failure.status === 403 ||
            failure.status === 404
              ? { data: null, updatedAt: null }
              : {}),
          }));
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, key, revision]);
  return {
    ...(state.key === key
      ? state
      : { data: null, error: null, loading: true, updatedAt: null }),
    refresh,
  };
}
