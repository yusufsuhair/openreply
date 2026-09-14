import { beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const { db, context, send } = vi.hoisted(() => ({
  db: {
    outgoingWebhook: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    webhookDelivery: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    dmLog: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  context: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: context,
  canManageWorkspace: (role: string) => ["OWNER", "ADMIN"].includes(role),
}));
vi.mock("@/lib/meta/oauth", () => ({
  encryptToken: (s: string) => "encrypted:" + s,
  decryptToken: () => "secret",
}));
vi.mock("@/lib/integrations/webhook-http", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../lib/integrations/webhook-http")
  >()),
  sendWebhook: send,
}));

import { GET, POST } from "../app/api/integrations/webhook/route";
import { dispatchWebhooks } from "../lib/integrations/webhook-dispatch";
import {
  parseWebhookUrl,
  isPublicIPv4,
  signWebhook,
} from "../lib/integrations/webhook-http";

const hook = {
  id: "hook",
  workspaceId: "workspace",
  enabled: true,
  enabledAt: new Date(),
  revision: "r1",
  url: "https://example.com/hook",
  secret: "encrypted",
};
const delivery = {
  id: "event",
  revision: "r1",
  status: "PENDING",
  attempts: 0,
  dmLog: {
    id: "dm",
    dmSentAt: new Date(),
    automationId: "campaign",
    automation: { name: "Campaign" },
    instagramAccountId: "account",
    commenterId: "sender",
    matchedKeyword: "LINK",
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  context.mockResolvedValue({ workspaceId: "workspace", role: "OWNER" });
  db.$transaction.mockImplementation((fn) => fn(db));
  db.outgoingWebhook.upsert.mockResolvedValue(hook);
  db.outgoingWebhook.findMany.mockResolvedValue([hook]);
  db.outgoingWebhook.findFirst.mockResolvedValue(hook);
  db.dmLog.findMany.mockResolvedValue([{ id: "dm" }]);
  db.webhookDelivery.findMany.mockResolvedValue([delivery]);
  db.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
  send.mockResolvedValue(204);
});
const post = (url: string, enabled: boolean) =>
  POST(
    new Request("https://openreply.test/api/integrations/webhook", {
      method: "POST",
      body: JSON.stringify({ url, enabled }),
    }),
  );

it("rejects private/reserved destinations, credentials, redirects-to-local syntax and unsigned body changes", () => {
  for (const url of [
    "http://example.com",
    "https://127.1",
    "https://2130706433",
    "https://10.0.0.1",
    "https://169.254.169.254",
    "https://[::1]",
    "https://localhost",
    "https://app.local",
    "https://a:b@example.com",
    "https://example.com:8080",
    "https://example.com/#secret",
  ])
    expect(() => parseWebhookUrl(url)).toThrow();
  for (const ip of [
    "0.0.0.0",
    "100.64.1.1",
    "172.16.1.1",
    "192.168.1.1",
    "198.18.1.1",
    "224.0.0.1",
    "::1",
  ])
    expect(isPublicIPv4(ip)).toBe(false);
  expect(parseWebhookUrl("https://example.com/hook?key=value").hostname).toBe(
    "example.com",
  );
  expect(isPublicIPv4("8.8.8.8")).toBe(true);
  expect(signWebhook('{"id":1}', "secret", "123")).toBe(
    createHmac("sha256", "secret").update('123.{"id":1}').digest("hex"),
  );
  expect(signWebhook('{"id":2}', "secret", "123")).not.toBe(
    signWebhook('{"id":1}', "secret", "123"),
  );
});

it("scopes reads to the workspace and never selects the secret", async () => {
  await GET();
  const query = db.outgoingWebhook.findUnique.mock.calls[0][0];
  expect(query.where).toEqual({ workspaceId: "workspace" });
  expect(query.select.secret).toBeUndefined();
  context.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  context.mockResolvedValue({ workspaceId: "workspace", role: "MEMBER" });
  expect((await post(hook.url, true)).status).toBe(403);
});

it("saves new/changed URLs off and requires a separate explicit activation", async () => {
  let response = await post(hook.url, true);
  expect((await response.json()).data).toMatchObject({
    enabled: false,
    signingSecret: expect.any(String),
  });
  expect(db.outgoingWebhook.upsert.mock.calls[0][0].create.enabled).toBe(false);
  db.outgoingWebhook.findUnique.mockResolvedValue({ ...hook, enabled: false });
  response = await post(hook.url, true);
  expect((await response.json()).data).toEqual({
    enabled: true,
    signingSecret: null,
  });
  expect(db.outgoingWebhook.upsert.mock.calls[1][0].update).toMatchObject({
    enabled: true,
    enabledAt: expect.any(Date),
  });
  response = await post("https://example.com/changed", true);
  expect((await response.json()).data.enabled).toBe(false);
  expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: "CANCELLED" } }),
  );
});

it("does nothing while off, and sends signed event data only for post-activation workspace records", async () => {
  db.outgoingWebhook.findMany.mockResolvedValueOnce([]);
  await dispatchWebhooks();
  expect(send).not.toHaveBeenCalled();
  expect(db.dmLog.findMany).not.toHaveBeenCalled();
  await dispatchWebhooks();
  expect(db.dmLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "workspace",
        status: "SENT",
        dmSentAt: { gte: hook.enabledAt },
        webhookDeliveries: { none: { webhookId: "hook" } },
      }),
    }),
  );
  expect(send).toHaveBeenCalledWith(
    hook.url,
    "secret",
    {
      id: "event",
      type: "message.sent",
      occurredAt: delivery.dmLog.dmSentAt,
      data: {
        campaignId: "campaign",
        campaignName: "Campaign",
        instagramAccountId: "account",
        senderId: "sender",
        matchedKeyword: "LINK",
        dmLogId: "dm",
      },
    },
    "event",
  );
  expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "DELIVERED" }),
    }),
  );
});

it("uses an atomic claim and rechecks activation/revision immediately before sending", async () => {
  db.webhookDelivery.updateMany.mockResolvedValueOnce({ count: 0 });
  await dispatchWebhooks();
  expect(send).not.toHaveBeenCalled();
  db.outgoingWebhook.findFirst.mockResolvedValue(null);
  await dispatchWebhooks();
  expect(send).not.toHaveBeenCalled();
  expect(db.outgoingWebhook.findFirst).toHaveBeenCalledWith({
    where: { id: "hook", enabled: true, revision: "r1" },
  });
  expect(db.webhookDelivery.update).toHaveBeenCalledWith({
    where: { id: "event" },
    data: { status: "CANCELLED" },
  });
});

it("retries failed receiver deliveries at most three times without leaking endpoint secrets", async () => {
  send.mockRejectedValue(new Error("https://example.com/?secret=do-not-log"));
  await dispatchWebhooks();
  expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING" }),
    }),
  );
  db.webhookDelivery.findMany.mockResolvedValue([{ ...delivery, attempts: 2 }]);
  await dispatchWebhooks();
  expect(db.webhookDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED" }),
    }),
  );
  expect(
    JSON.stringify(db.webhookDelivery.updateMany.mock.calls),
  ).not.toContain("do-not-log");
});
