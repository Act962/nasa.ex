import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ appType: string; appId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;
    if (!user)
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const org = await auth.api.getFullOrganization({
      headers: request.headers,
    });
    if (!org?.id)
      return NextResponse.json(
        { error: "Organização não encontrada" },
        { status: 400 },
      );

    const { appType, appId } = await params;

    switch (appType) {
      case "tracking":
        return await duplicateTracking(appId, org.id, user.id);
      case "workspace":
        return await duplicateWorkspace(appId, org.id, user.id);
      case "forge-proposal":
        return await duplicateProposal(appId, org.id, user.id);
      case "forge-contract":
        return await duplicateContract(appId, org.id, user.id);
      case "form":
        return await duplicateForm(appId, org.id, user.id);
      default:
        return NextResponse.json(
          { error: "Tipo não suportado" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Erro ao duplicar padrão:", error);
    return NextResponse.json(
      { error: "Erro ao duplicar padrão" },
      { status: 500 },
    );
  }
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

async function duplicateTracking(
  templateId: string,
  orgId: string,
  userId: string,
) {
  const tpl = await prisma.tracking.findUnique({
    where: { id: templateId },
    include: {
      status: { select: { name: true, color: true, order: true } },
      winLossReasons: { select: { name: true, type: true } },
      aiSettings: {
        select: { assistantName: true, prompt: true, finishSentence: true },
      },
      tags: {
        select: {
          name: true,
          slug: true,
          color: true,
          description: true,
          icon: true,
          type: true,
        },
      },
      workflows: {
        include: {
          nodes: {
            select: {
              id: true,
              name: true,
              type: true,
              position: true,
              data: true,
            },
          },
          connections: {
            select: {
              fromNodeId: true,
              toNodeId: true,
              fromOutput: true,
              toInput: true,
            },
          },
        },
      },
      agendas: {
        include: {
          availabilities: {
            include: {
              timeSlots: {
                select: { startTime: true, endTime: true, order: true },
              },
            },
          },
        },
      },
    },
  });
  if (!tpl)
    return NextResponse.json(
      { error: "Padrão não encontrado" },
      { status: 404 },
    );

  const created = await prisma.tracking.create({
    data: {
      name: tpl.name,
      description: tpl.description,
      organizationId: orgId,
      participants: { create: { userId, role: "OWNER" } },
      status: {
        createMany: {
          data: tpl.status.map((s) => ({
            name: s.name,
            color: s.color ?? "#1447e6",
            order: s.order,
          })),
        },
      },
      ...(tpl.winLossReasons.length > 0 && {
        winLossReasons: {
          createMany: {
            data: tpl.winLossReasons.map((r) => ({
              name: r.name,
              type: r.type,
            })),
          },
        },
      }),
      ...(tpl.aiSettings && {
        aiSettings: {
          create: {
            assistantName: tpl.aiSettings.assistantName,
            prompt: tpl.aiSettings.prompt,
            finishSentence: tpl.aiSettings.finishSentence,
          },
        },
      }),
      ...(tpl.tags.length > 0 && {
        tags: {
          createMany: {
            data: tpl.tags.map((t) => ({
              name: t.name,
              slug: t.slug + "-" + Date.now(),
              color: t.color,
              description: t.description,
              icon: t.icon,
              type: t.type,
              organizationId: orgId,
            })),
          },
        },
      }),
    },
  });

  // Duplicate workflows with node ID remapping for connections
  for (const wf of tpl.workflows) {
    const createdWf = await prisma.workflow.create({
      data: {
        name: wf.name,
        description: wf.description,
        trackingId: created.id,
        userId,
      },
    });

    const nodeIdMap = new Map<string, string>();
    for (const node of wf.nodes) {
      const createdNode = await prisma.node.create({
        data: {
          workflowId: createdWf.id,
          name: node.name,
          type: node.type,
          position: node.position as any,
          data: node.data as any,
        },
      });
      nodeIdMap.set(node.id, createdNode.id);
    }

    for (const conn of wf.connections) {
      const newFrom = nodeIdMap.get(conn.fromNodeId);
      const newTo = nodeIdMap.get(conn.toNodeId);
      if (newFrom && newTo) {
        await prisma.connection.create({
          data: {
            workflowId: createdWf.id,
            fromNodeId: newFrom,
            toNodeId: newTo,
            fromOutput: conn.fromOutput,
            toInput: conn.toInput,
          },
        });
      }
    }
  }

  // Duplicate agendas with availability + time slots
  for (const agenda of tpl.agendas) {
    const createdAgenda = await prisma.agenda.create({
      data: {
        name: agenda.name,
        description: agenda.description,
        slug: agenda.slug + "-" + Date.now(),
        isActive: agenda.isActive,
        slotDuration: agenda.slotDuration,
        trackingId: created.id,
        organizationId: orgId,
        responsibles: { create: { userId } },
      },
    });

    for (const avail of agenda.availabilities) {
      const createdAvail = await prisma.agendaAvailability.create({
        data: {
          agendaId: createdAgenda.id,
          dayOfWeek: avail.dayOfWeek,
          isActive: avail.isActive,
          ...(avail.timeSlots.length > 0 && {
            timeSlots: {
              createMany: {
                data: avail.timeSlots.map((ts) => ({
                  startTime: ts.startTime,
                  endTime: ts.endTime,
                  order: ts.order,
                })),
              },
            },
          }),
        },
      });
    }
  }

  return NextResponse.json({ id: created.id, name: created.name });
}

// ─── Workspace ────────────────────────────────────────────────────────────────

async function duplicateWorkspace(
  templateId: string,
  orgId: string,
  userId: string,
) {
  const tpl = await prisma.workspace.findUnique({
    where: { id: templateId },
    include: {
      columns: { select: { name: true, color: true, order: true } },
      tags: { select: { name: true, color: true } },
      automations: {
        select: {
          name: true,
          isActive: true,
          trigger: true,
          triggerData: true,
          conditions: true,
          steps: true,
        },
      },
    },
  });
  if (!tpl)
    return NextResponse.json(
      { error: "Padrão não encontrado" },
      { status: 404 },
    );

  const members = await prisma.member.findMany({
    where: { organizationId: orgId },
  });

  const created = await prisma.workspace.create({
    data: {
      name: tpl.name,
      description: tpl.description,
      color: tpl.color,
      icon: tpl.icon,
      organizationId: orgId,
      createdBy: userId,
      members: {
        createMany: {
          data: members.map((m) => ({
            userId: m.userId,
            role: m.userId === userId ? "OWNER" : "MEMBER",
          })),
        },
      },
      columns: {
        createMany: {
          data:
            tpl.columns.length > 0
              ? tpl.columns.map((c) => ({
                  name: c.name,
                  color: c.color ?? "#1447e6",
                  order: c.order,
                }))
              : [
                  { name: "Para fazer", order: 0 },
                  { name: "Em progresso", order: 1 },
                  { name: "Concluído", order: 2 },
                ],
        },
      },
      ...(tpl.tags.length > 0 && {
        tags: {
          createMany: {
            data: tpl.tags.map((t) => ({ name: t.name, color: t.color })),
          },
        },
      }),
      ...(tpl.automations.length > 0 && {
        automations: {
          createMany: {
            data: tpl.automations.map((a) => ({
              name: a.name,
              isActive: a.isActive,
              trigger: a.trigger,
              triggerData: a.triggerData as any,
              conditions: a.conditions as any,
              steps: a.steps as any,
            })),
          },
        },
      }),
    },
  });

  return NextResponse.json({ id: created.id, name: created.name });
}

// ─── Forge Proposal ───────────────────────────────────────────────────────────

async function duplicateProposal(
  templateId: string,
  orgId: string,
  userId: string,
) {
  const tpl = await prisma.forgeProposal.findUnique({
    where: { id: templateId },
    include: {
      products: {
        select: {
          productId: true,
          quantity: true,
          unitValue: true,
          discount: true,
          description: true,
          order: true,
        },
      },
    },
  });
  if (!tpl)
    return NextResponse.json(
      { error: "Padrão não encontrado" },
      { status: 404 },
    );

  // Check which products exist in the target org
  const productIds = tpl.products.map((p) => p.productId);
  const existingProducts = await prisma.forgeProduct.findMany({
    where: { id: { in: productIds }, organizationId: orgId },
    select: { id: true },
  });
  const existingProductIds = new Set(existingProducts.map((p) => p.id));

  const created = await prisma.forgeProposal.create({
    data: {
      title: tpl.title,
      description: tpl.description,
      organizationId: orgId,
      responsibleId: userId,
      createdById: userId,
      number: await getNextProposalNumber(orgId),
      discount: tpl.discount,
      discountType: tpl.discountType,
      validUntil: tpl.validUntil,
      ...(tpl.products.length > 0 && {
        products: {
          createMany: {
            data: tpl.products
              .filter((p) => existingProductIds.has(p.productId))
              .map((p) => ({
                productId: p.productId,
                quantity: p.quantity,
                unitValue: p.unitValue,
                discount: p.discount,
                description: p.description,
                order: p.order,
              })),
          },
        },
      }),
    },
  });

  return NextResponse.json({ id: created.id, name: tpl.title });
}

async function getNextProposalNumber(orgId: string): Promise<number> {
  const last = await prisma.forgeProposal.findFirst({
    where: { organizationId: orgId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// ─── Forge Contract ───────────────────────────────────────────────────────────

async function duplicateContract(
  templateId: string,
  orgId: string,
  userId: string,
) {
  const tpl = await prisma.forgeContract.findUnique({
    where: { id: templateId },
  });
  if (!tpl)
    return NextResponse.json(
      { error: "Padrão não encontrado" },
      { status: 404 },
    );

  const created = await prisma.forgeContract.create({
    data: {
      organizationId: orgId,
      number: await getNextContractNumber(orgId),
      startDate: tpl.startDate,
      endDate: tpl.endDate,
      value: tpl.value,
      content: tpl.content,
      signers: tpl.signers as any,
      createdById: userId,
    },
  });

  return NextResponse.json({
    id: created.id,
    name: `Contrato #${created.number}`,
  });
}

async function getNextContractNumber(orgId: string): Promise<number> {
  const last = await prisma.forgeContract.findFirst({
    where: { organizationId: orgId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function unlockBlocks(blocks: any[]): any[] {
  return blocks.map((block) => ({
    ...block,
    isLocked: false,
    childblocks: block.childblocks
      ? unlockBlocks(block.childblocks)
      : undefined,
  }));
}

async function duplicateForm(
  templateId: string,
  orgId: string,
  userId: string,
) {
  const tpl = await prisma.form.findUnique({ where: { id: templateId } });
  if (!tpl)
    return NextResponse.json(
      { error: "Padrão não encontrado" },
      { status: 404 },
    );

  let blocks: any[] = [];
  try {
    blocks = JSON.parse(tpl.jsonBlock);
  } catch {}
  const unlockedJson = JSON.stringify(unlockBlocks(blocks));

  const created = await prisma.form.create({
    data: {
      name: tpl.name,
      description: tpl.description,
      jsonBlock: unlockedJson,
      content: unlockedJson,
      published: false,
      organizationId: orgId,
      userId,
      shareUrl: `${orgId}-${Date.now()}`,
      settings: {
        create: { primaryColor: "#673ab7", backgroundColor: "#f0ebf8" },
      },
    },
  });

  return NextResponse.json({ id: created.id, name: created.name });
}
