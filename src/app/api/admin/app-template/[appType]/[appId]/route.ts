import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  appType: string;
  appId: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;

    if (!user?.isSystemAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem marcar padrões" },
        { status: 403 }
      );
    }

    const { appType, appId } = params;
    const body = await request.json();
    const { templateMarkedByModerator } = body;

    if (typeof templateMarkedByModerator !== "boolean") {
      return NextResponse.json(
        { error: "templateMarkedByModerator deve ser um booleano" },
        { status: 400 }
      );
    }

    let updated;

    switch (appType) {
      case "tracking": {
        updated = await prisma.tracking.update({
          where: { id: appId },
          data: {
            isTemplate: templateMarkedByModerator,
            templateMarkedByModerator,
          },
        });
        break;
      }
      case "workspace": {
        updated = await prisma.workspace.update({
          where: { id: appId },
          data: {
            isTemplate: templateMarkedByModerator,
            templateMarkedByModerator,
          },
        });
        break;
      }
      case "forge-proposal": {
        updated = await prisma.forgeProposal.update({
          where: { id: appId },
          data: {
            isTemplate: templateMarkedByModerator,
            templateMarkedByModerator,
          },
        });
        break;
      }
      case "forge-contract": {
        updated = await prisma.forgeContract.update({
          where: { id: appId },
          data: {
            isTemplate: templateMarkedByModerator,
            templateMarkedByModerator,
          },
        });
        break;
      }
      default:
        return NextResponse.json(
          { error: "Tipo de app inválido" },
          { status: 400 }
        );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao marcar padrão:", error);
    return NextResponse.json(
      { error: "Erro ao marcar padrão" },
      { status: 500 }
    );
  }
}
