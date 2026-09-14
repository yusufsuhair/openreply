import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can disconnect accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;

  if (!instagramAccountId) {
    return NextResponse.json(
      { success: false, error: "Instagram account ID is required" },
      { status: 400 }
    );
  }

  const [account, campaigns] = await prisma.$transaction([
    prisma.instagramAccount.updateMany({
      where: { id: instagramAccountId, workspaceId: context.workspaceId },
      data: {
        accessToken: "",
        tokenExpiresAt: null,
        webhookSubscribed: false,
      },
    }),
    prisma.automation.updateMany({
      where: { instagramAccountId, workspaceId: context.workspaceId },
      data: { isActive: false },
    }),
  ]);

  if (account.count === 0) {
    return NextResponse.json(
      { success: false, error: "Instagram account not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { preservedCampaigns: campaigns.count },
  });
}
