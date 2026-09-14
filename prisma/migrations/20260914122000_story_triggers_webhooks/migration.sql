ALTER TABLE "Automation"
  ADD COLUMN "commentTriggerEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "storyReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "storyMentionEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OutgoingWebhook" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabledAt" TIMESTAMP(3),
  "revision" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "webhookId" TEXT NOT NULL REFERENCES "OutgoingWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dmLogId" TEXT NOT NULL REFERENCES "DmLog"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "revision" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "httpStatus" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("webhookId", "dmLogId")
);
CREATE INDEX "WebhookDelivery_webhookId_status_nextAttemptAt_idx" ON "WebhookDelivery"("webhookId", "status", "nextAttemptAt");

CREATE INDEX "DmLog_workspaceId_status_dmSentAt_idx" ON "DmLog"("workspaceId", "status", "dmSentAt");
