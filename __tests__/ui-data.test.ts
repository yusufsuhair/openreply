import { afterEach, describe, expect, it, vi } from "vitest";
import { requestData } from "../lib/use-api-data";

vi.mock("@/components/account-context", () => ({
  useCacheScope: () => "test-workspace",
}));
afterEach(() => vi.unstubAllGlobals());

describe("UI data and mutation responses", () => {
  it("rejects an HTTP failure even if the body claims success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ success: true }, { status: 403 })),
    );
    await expect(
      requestData("/api/automations?id=one", { method: "PATCH" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("does not turn malformed or unsuccessful reads into empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 502 })),
    );
    await expect(requestData("/api/automations")).rejects.toMatchObject({
      status: 502,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ success: false, error: "Database unavailable" }),
        ),
    );
    await expect(requestData("/api/automations")).rejects.toThrow(
      "Database unavailable",
    );
  });
  it("preserves a real empty success and explains expired sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ success: true, data: [] })),
    );
    await expect(requestData("/api/automations")).resolves.toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ success: false }, { status: 401 })),
    );
    await expect(requestData("/api/automations")).rejects.toThrow(
      "sign in again",
    );
  });
});
