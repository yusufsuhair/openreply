import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getUserInfo, TokenExpiredError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { getReadCache } from "@/lib/ops/read-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId, accessToken: { not: "" } },
    orderBy: { connectedAt: "desc" },
  });
  const cache = getReadCache();
  const [heartbeat, checkedAccounts] = await Promise.all([
    cache.get("health:worker:dm").catch(() => null),
    Promise.all(
      accounts.map(async (account) => {
        const key = `connection:${workspaceId}:${account.id}:${createHash("sha256").update(account.accessToken).digest("hex").slice(0, 20)}`;
        let state = "unknown";
        if (
          !account.accessToken ||
          (account.tokenExpiresAt && account.tokenExpiresAt < new Date())
        )
          state = "reconnect";
        else {
          const cached = await cache.get(key).catch(() => null);
          if (cached === "verified" || cached === "reconnect") state = cached;
          else {
            try {
              await getUserInfo(
                decryptToken(account.accessToken),
                AbortSignal.timeout(8000),
              );
              state = "verified";
            } catch (error) {
              state =
                error instanceof TokenExpiredError ? "reconnect" : "unknown";
            }
            await cache.set(key, state, "EX", 60).catch(() => {});
          }
        }
        return {
          id: account.id,
          username: account.username,
          state,
          webhookSubscribed: account.webhookSubscribed,
        };
      }),
    ),
  ]);
  let workerHealthy = false;
  try {
    workerHealthy = Boolean(
      heartbeat &&
        Date.now() - Date.parse(JSON.parse(heartbeat).checkedAt) < 120000,
    );
  } catch {}
  return NextResponse.json(
    {
      success: true,
      data: {
        workerHealthy,
        accounts: checkedAccounts,
        checkedAt: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
