import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentWorkspaceId: mocks.workspace }));
vi.mock("@/lib/workspace-access", () => ({
  canManageWorkspace: vi.fn(),
  getCurrentWorkspaceContext: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    automation: { findMany: mocks.findMany, update: mocks.update },
    dmLog: { groupBy: mocks.groupBy },
    linkClick: { groupBy: mocks.groupBy },
  },
}));
import { GET } from "../app/api/automations/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("own-workspace");
  mocks.groupBy.mockResolvedValue([]);
});
it("scopes a detail request and its analytics to the authorized workspace and selected ID", async () => {
  mocks.findMany.mockResolvedValue([
    { id: "one", trackedLinks: [], reportShareSlug: null },
  ]);
  const response = await GET(
    new NextRequest("https://example.test/api/automations?id=one"),
  );
  expect(response.status).toBe(200);
  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { workspaceId: "own-workspace", id: "one" },
    }),
  );
  for (const [args] of mocks.groupBy.mock.calls)
    expect(args.where).toMatchObject({
      workspaceId: "own-workspace",
      automationId: { in: ["one"] },
    });
  expect(mocks.update).not.toHaveBeenCalled();
});
it("returns a real 404 for absent or inaccessible IDs, and rejects anonymous reads", async () => {
  mocks.findMany.mockResolvedValue([]);
  expect(
    (
      await GET(
        new NextRequest("https://example.test/api/automations?id=foreign"),
      )
    ).status,
  ).toBe(404);
  expect(mocks.groupBy).not.toHaveBeenCalled();
  mocks.workspace.mockResolvedValue(null);
  expect(
    (await GET(new NextRequest("https://example.test/api/automations?id=one")))
      .status,
  ).toBe(401);
});
