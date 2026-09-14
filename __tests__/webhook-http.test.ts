import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";

const { lookup, request } = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
}));
vi.mock("node:dns/promises", () => ({ lookup }));
vi.mock("node:https", () => ({ request }));
import { sendWebhook, signWebhook } from "../lib/integrations/webhook-http";

beforeEach(() => {
  vi.resetAllMocks();
});

it("rejects private DNS answers and pins each HTTPS attempt to a freshly checked public address", async () => {
  lookup.mockResolvedValue([{ address: "8.8.8.8" }, { address: "127.0.0.1" }]);
  await expect(
    sendWebhook("https://example.com/hook", "secret", { id: 1 }, "event"),
  ).rejects.toThrow("public IPv4");
  expect(request).not.toHaveBeenCalled();
  lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
  request.mockImplementation((url, options, callback) => {
    expect(url.hostname).toBe("example.com");
    const done = vi.fn();
    options.lookup("example.com", {}, done);
    expect(done).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    const req = new EventEmitter() as EventEmitter & {
      end: (body: string) => void;
    };
    req.end = (body) => {
      expect(options.headers["X-OpenReply-Signature"]).toBe(
        "sha256=" +
          signWebhook(body, "secret", options.headers["X-OpenReply-Timestamp"]),
      );
      expect(options.headers["X-OpenReply-Event-Id"]).toBe("event");
      callback({ statusCode: 302, destroy: vi.fn() });
      req.emit("close");
    };
    return req;
  });
  // Redirect is returned as a failure status, never followed into a private network.
  expect(
    await sendWebhook("https://example.com/hook", "secret", { id: 1 }, "event"),
  ).toBe(302);
  expect(request).toHaveBeenCalledTimes(1);
  lookup.mockResolvedValue([{ address: "10.0.0.1" }]);
  await expect(
    sendWebhook("https://example.com/hook", "secret", { id: 1 }, "event"),
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
