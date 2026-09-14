"use client";

import Link, { useLinkStatus } from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCacheScope } from "@/components/account-context";

export default function RememberedLink(
  props: React.ComponentProps<typeof Link>,
) {
  const scope = useCacheScope();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        const path = typeof props.href === "string" ? props.href : null;
        if (!path || path.includes("?")) return;
        try {
          const saved = sessionStorage.getItem(`${scope}:route:${path}`);
          if (saved && saved.startsWith(`${path}?`)) {
            event.preventDefault();
            startTransition(() => router.push(saved));
          }
        } catch {}
      }}
    >
      {props.children}
      <Pending pending={pending} />
    </Link>
  );
}

function Pending({ pending }: { pending: boolean }) {
  const status = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={pending || status.pending ? "ml-1" : "hidden"}
    >
      …
    </span>
  );
}
