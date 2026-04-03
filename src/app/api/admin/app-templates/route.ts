import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appType = searchParams.get("appType");

    const templates = {
      tracking: [] as any[],
      workspace: [] as any[],
      forgeProposal: [] as any[],
      forgeContract: [] as any[],
    };

    if (!appType || appType === "tracking") {
      templates.tracking = await prisma.tracking.findMany({
        where: { isTemplate: true, templateMarkedByModerator: true },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!appType || appType === "workspace") {
      templates.workspace = await prisma.workspace.findMany({
        where: { isTemplate: true, templateMarkedByModerator: true },
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          icon: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!appType || appType === "forge-proposal") {
      templates.forgeProposal = await prisma.forgeProposal.findMany({
        where: { isTemplate: true, templateMarkedByModerator: true },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!appType || appType === "forge-contract") {
      templates.forgeContract = await prisma.forgeContract.findMany({
        where: { isTemplate: true, templateMarkedByModerator: true },
        select: {
          id: true,
          organizationId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Erro ao buscar padrões:", error);
    return NextResponse.json(
      { error: "Erro ao buscar padrões" },
      { status: 500 }
    );
  }
}
