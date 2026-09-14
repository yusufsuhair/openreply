"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

const AccountContext = createContext({
  scope: "",
  account: "all",
  ready: false,
  select: (_id: string) => {
    void _id;
  },
});

export function AccountProvider({
  scope,
  children,
}: {
  scope: string;
  children: React.ReactNode;
}) {
  const [account, setAccount] = useState("all");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setAccount(sessionStorage.getItem(`${scope}:account`) || "all");
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [scope]);
  const select = useCallback(
    (id: string) => {
      setAccount(id);
      try {
        sessionStorage.setItem(`${scope}:account`, id);
      } catch {}
    },
    [scope],
  );
  return (
    <AccountContext.Provider value={{ scope, account, ready, select }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountFilter() {
  const context = useContext(AccountContext);
  const params = useSearchParams();
  const requested = params.get("instagramAccountId");
  const account = requested || context.account;
  const selectAccount = context.select;
  useEffect(() => {
    if (context.ready && requested && requested !== context.account)
      selectAccount(requested);
  }, [context.ready, requested, context.account, selectAccount]);
  function select(id: string) {
    context.select(id);
    updateQuery({ instagramAccountId: id, page: null });
  }
  return { ...context, account, select };
}

export function useCacheScope() {
  return useContext(AccountContext).scope;
}

export function updateQuery(values: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url);
}
