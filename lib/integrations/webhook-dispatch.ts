import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";
import { sendWebhook } from "./webhook-http";

let running = false;

export async function dispatchWebhooks() {
  if (running) return;
  running = true;
  try {
    const hooks = await prisma.outgoingWebhook.findMany({
      where: { enabled: true, enabledAt: { not: null } },
    });
    for (const hook of hooks) {
      // ponytail: bounded polling outbox (50 new events/run); use event-driven
      // enqueue if sustained traffic exceeds the 30-second polling capacity.
      const logs = await prisma.dmLog.findMany({
        where: {
          workspaceId: hook.workspaceId,
          status: "SENT",
          dmSentAt: { gte: hook.enabledAt! },
          webhookDeliveries: { none: { webhookId: hook.id } },
        },
        select: { id: true },
        orderBy: [{ dmSentAt: "asc" }, { id: "asc" }],
        take: 50,
      });
      if (logs.length)
        await prisma.webhookDelivery.createMany({
          data: logs.map((log) => ({
            webhookId: hook.id,
            dmLogId: log.id,
            revision: hook.revision,
          })),
          skipDuplicates: true,
        });
      const deliveries = await prisma.webhookDelivery.findMany({
        where: {
          webhookId: hook.id,
          revision: hook.revision,
          status: { in: ["PENDING", "SENDING"] },
          nextAttemptAt: { lte: new Date() },
          attempts: { lt: 3 },
        },
        include: {
          dmLog: { include: { automation: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      });
      for (const delivery of deliveries) {
        const claim = await prisma.webhookDelivery.updateMany({
          where: {
            id: delivery.id,
            status: delivery.status,
            attempts: delivery.attempts,
            nextAttemptAt: { lte: new Date() },
          },
          data: {
            status: "SENDING",
            attempts: { increment: 1 },
            nextAttemptAt: new Date(Date.now() + 60_000),
          },
        });
        if (!claim.count) continue;
        // Recheck right before sending: disabling or changing the destination
        // cancels queued deliveries. A request already in flight cannot be recalled.
        const current = await prisma.outgoingWebhook.findFirst({
          where: { id: hook.id, enabled: true, revision: delivery.revision },
        });
        if (!current) {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: { status: "CANCELLED" },
          });
          continue;
        }
        const log = delivery.dmLog;
        let status: number | null = null;
        let error: string | null = null;
        try {
          status = await sendWebhook(
            current.url,
            decryptToken(current.secret),
            {
              id: delivery.id,
              type: "message.sent",
              occurredAt: log.dmSentAt,
              data: {
                campaignId: log.automationId,
                campaignName: log.automation.name,
                instagramAccountId: log.instagramAccountId,
                senderId: log.commenterId,
                matchedKeyword: log.matchedKeyword,
                dmLogId: log.id,
              },
            },
            delivery.id,
          );
          if (status < 200 || status >= 300)
            error = "Receiver returned HTTP " + status;
        } catch {
          error =
            "Unable to deliver. Check the public HTTPS endpoint and receiver availability.";
        }
        const success = !error;
        await prisma.webhookDelivery.updateMany({
          where: {
            id: delivery.id,
            status: "SENDING",
            revision: delivery.revision,
          },
          data: {
            status: success
              ? "DELIVERED"
              : delivery.attempts + 1 >= 3
                ? "FAILED"
                : "PENDING",
            httpStatus: status,
            error,
            nextAttemptAt: new Date(
              Date.now() + (delivery.attempts + 1) * 60_000,
            ),
          },
        });
      }
      // Recover a worker crash during the final attempt without an endless lease.
      await prisma.webhookDelivery.updateMany({
        where: {
          webhookId: hook.id,
          status: "SENDING",
          attempts: { gte: 3 },
          nextAttemptAt: { lt: new Date() },
        },
        data: {
          status: "FAILED",
          error: "Final attempt interrupted; delivery outcome unknown.",
        },
      });
    }
  } finally {
    running = false;
  }
}
