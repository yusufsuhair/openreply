import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { encryptToken } from "@/lib/meta/oauth";
import { parseWebhookUrl } from "@/lib/integrations/webhook-http";

export const dynamic = "force-dynamic";
const schema = z.object({
  url: z.string().max(2048),
  enabled: z.boolean().default(false),
});

export async function GET() {
  const ctx = await getCurrentWorkspaceContext();
  if (!ctx)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  if (!canManageWorkspace(ctx.role))
    return NextResponse.json(
      {
        success: false,
        error: "Only owners and admins can manage integrations",
      },
      { status: 403 },
    );
  const hook = await prisma.outgoingWebhook.findUnique({
    where: { workspaceId: ctx.workspaceId },
    select: {
      id: true,
      url: true,
      enabled: true,
      enabledAt: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          attempts: true,
          httpStatus: true,
          error: true,
          createdAt: true,
        },
      },
    },
  });
  return NextResponse.json(
    {
      success: true,
      data: hook ?? { url: "", enabled: false, deliveries: [] },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const ctx = await getCurrentWorkspaceContext();
  if (!ctx)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  if (!canManageWorkspace(ctx.role))
    return NextResponse.json(
      {
        success: false,
        error: "Only owners and admins can manage integrations",
      },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: "Enter an HTTPS webhook URL" },
      { status: 400 },
    );
  try {
    parseWebhookUrl(parsed.data.url);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Use a public HTTPS endpoint on port 443 without credentials or a fragment",
      },
      { status: 400 },
    );
  }
  const existing = await prisma.outgoingWebhook.findUnique({
    where: { workspaceId: ctx.workspaceId },
  });
  // A new or changed destination is always saved off. Activation is a separate
  // explicit save so a typo cannot immediately receive customer events.
  const sameUrl = existing?.url === parsed.data.url;
  const enabled = Boolean(sameUrl && parsed.data.enabled);
  const newSecret =
    !existing || !sameUrl ? randomBytes(32).toString("hex") : null;
  if (existing && sameUrl && existing.enabled === enabled) {
    return NextResponse.json(
      { success: true, data: { enabled, signingSecret: null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const revision = randomUUID();
  await prisma.$transaction(async (tx) => {
    const hook = await tx.outgoingWebhook.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: {
        workspaceId: ctx.workspaceId,
        url: parsed.data.url,
        enabled: false,
        secret: existing?.secret ?? encryptToken(newSecret!),
        revision,
      },
      update: {
        url: parsed.data.url,
        enabled,
        revision,
        enabledAt: enabled
          ? existing?.enabled && sameUrl
            ? existing.enabledAt
            : new Date()
          : null,
        ...(newSecret ? { secret: encryptToken(newSecret) } : {}),
      },
    });
    await tx.webhookDelivery.updateMany({
      where: { webhookId: hook.id, status: { in: ["PENDING", "SENDING"] } },
      data: { status: "CANCELLED" },
    });
  });
  return NextResponse.json(
    { success: true, data: { enabled, signingSecret: newSecret } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
