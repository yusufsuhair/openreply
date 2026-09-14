import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getRedisConnection } from "@/lib/queue/client";
import { sendOperationalEmail } from "@/lib/ops/email";

const alertSchema = z.object({
  kind: z.enum(["instagram_token_invalid", "worker_job_failed"]),
  instagramId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

const ALERT_COOLDOWN_SECONDS = 6 * 60 * 60;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = alertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid alert" }, { status: 400 });
  }

  const account = await prisma.instagramAccount.findUnique({
    where: { instagramId: parsed.data.instagramId },
    select: {
      id: true,
      username: true,
      workspace: { select: { owner: { select: { email: true } } } },
    },
  });
  const recipient = account?.workspace.owner.email;
  if (!account || !recipient) {
    return NextResponse.json({ success: false, error: "Alert recipient not found" }, { status: 404 });
  }

  const redis = getRedisConnection();
  const cooldownKey = `alerts:email:${parsed.data.kind}:${account.id}`;
  const acquired = await redis.set(cooldownKey, "1", "EX", ALERT_COOLDOWN_SECONDS, "NX");
  if (!acquired) return NextResponse.json({ success: true, deduplicated: true });

  const tokenInvalid = parsed.data.kind === "instagram_token_invalid";
  try {
    await sendOperationalEmail({
      to: recipient,
      subject: tokenInvalid
        ? `OpenReply: reconnect @${account.username}`
        : `OpenReply: DM worker failure for @${account.username}`,
      text: tokenInvalid
        ? `OpenReply cannot send Instagram DMs for @${account.username} because Meta invalidated the access token. Reconnect the account at ${process.env.NEXTAUTH_URL}/settings.\n\n${parsed.data.message}`
        : `OpenReply exhausted all retries for a DM job on @${account.username}. Check diagnostics at ${process.env.NEXTAUTH_URL}/diagnostics.\n\n${parsed.data.message}`,
    });
  } catch (error) {
    await redis.del(cooldownKey);
    throw error;
  }

  return NextResponse.json({ success: true });
}
