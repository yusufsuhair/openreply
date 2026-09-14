"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCacheScope } from "@/components/account-context";

export default function RememberedLink(
  props: React.ComponentProps<typeof Link>,
) {
  const scope = useCacheScope();
  const router = useRouter();
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
            router.push(saved);
          }
        } catch {}
      }}
    />
  );
}
