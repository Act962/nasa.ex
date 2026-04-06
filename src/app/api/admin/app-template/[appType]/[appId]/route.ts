import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ appType: string; appId: string }>;
}

async function getOrgIdForApp(appType: string, appId: string): Promise<string | null> {
  switch (appType) {
    case "tracking": {
      const t = await prisma.tracking.findUnique({ where: { id: appId }, select: { organizationId: true } });
      return t?.organizationId ?? null;
    }
    case "workspace": {
      const w = await prisma.workspace.findUnique({ where: { id: appId }, select: { organizationId: true } });
      return w?.organizationId ?? null;
    }
    case "forge-proposal": {
      const p = await prisma.forgeProposal.findUnique({ where: { id: appId }, select: { organizationId: true } });
      return p?.organizationId ?? null;
    }
    case "forge-contract": {
      const c = await prisma.forgeContract.findUnique({ where: { id: appId }, select: { organizationId: true } });
      return c?.organizationId ?? null;
    }
    case "form": {
      const f = await prisma.form.findUnique({ where: { id: appId }, select: { organizationId: true } });
      return f?.organizationId ?? null;
    }
    default:
      return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { appType, appId } = await params;

    // Verificar permissão: isSystemAdmin OU moderador da organização dona do app
    if (!user.isSystemAdmin) {
      const orgId = await getOrgIdForApp(appType, appId);
      if (!orgId) {
        return NextResponse.json({ error: "App não encontrado" }, { status: 404 });
      }

      const member = await prisma.member.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
        select: { role: true },
      });

      if (!member || !["moderador", "owner", "admin"].includes(member.role)) {
        return NextResponse.json(
          { error: "Apenas moderadores podem marcar padrões" },
          { status: 403 }
        );
      }
    }

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
          data: { isTemplate: templateMarkedByModerator, templateMarkedByModerator },
        });
        break;
      }
      case "workspace": {
        updated = await prisma.workspace.update({
          where: { id: appId },
          data: { isTemplate: templateMarkedByModerator, templateMarkedByModerator },
        });
        break;
      }
      case "forge-proposal": {
        updated = await prisma.forgeProposal.update({
          where: { id: appId },
          data: { isTemplate: templateMarkedByModerator, templateMarkedByModerator },
        });
        break;
      }
      case "forge-contract": {
        updated = await prisma.forgeContract.update({
          where: { id: appId },
          data: { isTemplate: templateMarkedByModerator, templateMarkedByModerator },
        });
        break;
      }
      case "form": {
        updated = await prisma.form.update({
          where: { id: appId },
          data: { isTemplate: templateMarkedByModerator, templateMarkedByModerator },
        });
        break;
      }
      default:
        return NextResponse.json({ error: "Tipo de app inválido" }, { status: 400 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao marcar padrão:", error);
    return NextResponse.json({ error: "Erro ao marcar padrão" }, { status: 500 });
  }
}
