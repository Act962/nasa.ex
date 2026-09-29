import "server-only";
import prisma from "@/lib/prisma";
import { daysFromNow, sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

const COLUMN_NAMES = ["Para fazer", "Em progresso", "Em revisão", "Concluído"];

const SAMPLE_ACTIONS = [
  {
    title: "Cadastrar os produtos no catálogo",
    description: "Revise preços, fotos e descrições dos principais produtos da loja.",
    columnIndex: 0,
    priority: "HIGH" as const,
    dueInDays: 3,
  },
  {
    title: "Conectar o WhatsApp da empresa",
    description: "Conecte o número de atendimento para centralizar as conversas com os clientes.",
    columnIndex: 0,
    priority: "MEDIUM" as const,
    dueInDays: 5,
  },
  {
    title: "Convidar a equipe",
    description: "Adicione vendedores e atendentes para dividir as tarefas do dia a dia.",
    columnIndex: 1,
    priority: "MEDIUM" as const,
    dueInDays: 2,
  },
  {
    title: "Criar a conta da empresa",
    description: "Primeiro passo concluído: sua empresa já está no N.A.S.A.",
    columnIndex: 3,
    priority: "LOW" as const,
    dueInDays: 0,
  },
];

export async function seedSampleWorkspace(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: sampleName("Projeto de boas-vindas"),
        description: "Um quadro de exemplo com as primeiras tarefas para colocar a empresa para rodar.",
        organizationId: context.organizationId,
        createdBy: context.ownerUserId,
        members: { create: { userId: context.ownerUserId, role: "OWNER" } },
      },
    });

    const columns: { id: string }[] = [];
    for (const [index, columnName] of COLUMN_NAMES.entries()) {
      columns.push(
        await tx.workspaceColumn.create({
          data: { name: columnName, order: index, workspaceId: workspace.id },
        }),
      );
    }

    for (const [index, sampleAction] of SAMPLE_ACTIONS.entries()) {
      const isDone = sampleAction.columnIndex === COLUMN_NAMES.length - 1;
      await tx.action.create({
        data: {
          title: sampleAction.title,
          description: sampleAction.description,
          priority: sampleAction.priority,
          order: index,
          dueDate: daysFromNow(sampleAction.dueInDays, 18),
          isDone,
          closedAt: isDone ? new Date() : null,
          workspaceId: workspace.id,
          columnId: columns[sampleAction.columnIndex].id,
          organizationId: context.organizationId,
          createdBy: context.ownerUserId,
          participants: { create: { userId: context.ownerUserId } },
          responsibles: { create: { userId: context.ownerUserId } },
        },
      });
    }
  });
}
