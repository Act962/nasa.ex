import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import {
  KNOWLEDGE_DOC_MAX_CHARS,
  KNOWLEDGE_TOTAL_MAX_CHARS,
} from "@/features/astro/server/knowledge/load-knowledge";
import { recordAstroFeedback, toFeedbackRating } from "@/features/astro/server/knowledge/feedback";

/**
 * Auto Inteligência do ASTRO (spec 0028, RF-13 a RF-16): conhecimento em
 * Markdown, memórias da organização e o feedback que vira sugestão.
 */

const orgProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

const MANAGER_ROLES = new Set(["owner", "admin"]);

type OrgContext = {
  user: { id: string };
  org: { id: string; members: { userId: string; role: string }[] };
};

/** Ativar uma memória muda o que o ASTRO responde para a empresa inteira. */
function assertCanManage(context: OrgContext) {
  const member = context.org.members.find((orgMember) => orgMember.userId === context.user.id);
  const roles = (member?.role ?? "").split(",").map((role) => role.trim());
  if (!roles.some((role) => MANAGER_ROLES.has(role))) {
    throw new ORPCError("FORBIDDEN", {
      message: "Só donos e admins mudam a inteligência do ASTRO.",
    });
  }
}

// ── Conhecimento ──────────────────────────────────────────────────────────

const listKnowledge = orgProcedure.handler(async ({ context }) => {
  const documents = await prisma.aiKnowledge.findMany({
    where: { organizationId: context.org.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      content: true,
      errorMessage: true,
      updatedAt: true,
      creator: { select: { name: true } },
    },
  });

  const totalChars = documents.reduce(
    (total, document) => total + (document.content?.length ?? 0),
    0,
  );
  return {
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      status: document.status,
      chars: document.content?.length ?? 0,
      errorMessage: document.errorMessage,
      updatedAt: document.updatedAt,
      authorName: document.creator?.name ?? null,
    })),
    totalChars,
    limits: { perDocument: KNOWLEDGE_DOC_MAX_CHARS, total: KNOWLEDGE_TOTAL_MAX_CHARS },
  };
});

const getKnowledge = orgProcedure
  .input(z.object({ knowledgeId: z.string() }))
  .handler(async ({ context, input }) => {
    const document = await prisma.aiKnowledge.findFirst({
      where: { id: input.knowledgeId, organizationId: context.org.id },
      select: { id: true, name: true, content: true, type: true, status: true },
    });
    if (!document) throw new ORPCError("NOT_FOUND", { message: "Documento não encontrado." });
    return { ...document, content: document.content ?? "" };
  });

const saveKnowledge = orgProcedure
  .input(
    z.object({
      knowledgeId: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      content: z.string().max(KNOWLEDGE_DOC_MAX_CHARS),
    }),
  )
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const data = {
      name: input.name,
      content: input.content,
      type: "md",
      // Markdown não passa por fila: o que foi escrito já vale no próximo prompt.
      status: "READY" as const,
      errorMessage: null,
    };

    if (input.knowledgeId) {
      const existing = await prisma.aiKnowledge.findFirst({
        where: { id: input.knowledgeId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Documento não encontrado." });
      await prisma.aiKnowledge.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }

    const created = await prisma.aiKnowledge.create({
      data: { ...data, organizationId: context.org.id, createdBy: context.user.id },
      select: { id: true },
    });
    return { id: created.id };
  });

const deleteKnowledge = orgProcedure
  .input(z.object({ knowledgeId: z.string() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const document = await prisma.aiKnowledge.findFirst({
      where: { id: input.knowledgeId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!document) throw new ORPCError("NOT_FOUND", { message: "Documento não encontrado." });
    await prisma.aiKnowledge.delete({ where: { id: document.id } });
    return { id: document.id };
  });

// ── Memórias ──────────────────────────────────────────────────────────────

const memoryKind = z.enum(["FACT", "RULE", "PREFERENCE"]);
const memoryStatus = z.enum(["SUGGESTED", "ACTIVE", "ARCHIVED"]);

const listMemories = orgProcedure
  .input(z.object({ status: memoryStatus.optional() }).optional())
  .handler(async ({ context, input }) => {
    const memories = await prisma.astroMemory.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.status ? { status: input.status } : {}),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        kind: true,
        content: true,
        status: true,
        source: true,
        scope: true,
        ruleKey: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    });
    return {
      memories,
      suggestedCount: memories.filter((memory) => memory.status === "SUGGESTED").length,
      activeCount: memories.filter((memory) => memory.status === "ACTIVE").length,
    };
  });

const createMemory = orgProcedure
  .input(
    z.object({
      kind: memoryKind,
      content: z.string().trim().min(4).max(500),
      ruleKey: z.string().trim().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const created = await prisma.astroMemory.create({
      data: {
        organizationId: context.org.id,
        kind: input.kind,
        content: input.content,
        ruleKey: input.ruleKey ?? null,
        // Escrita por um admin já nasce valendo; só a sugestão do robô espera.
        status: "ACTIVE",
        source: "MANUAL",
        createdById: context.user.id,
        approvedById: context.user.id,
      },
      select: { id: true },
    });
    return created;
  });

const setMemoryStatus = orgProcedure
  .input(z.object({ memoryId: z.string(), status: memoryStatus }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const memory = await prisma.astroMemory.findFirst({
      where: { id: input.memoryId, organizationId: context.org.id },
      select: { id: true, ruleKey: true },
    });
    if (!memory) throw new ORPCError("NOT_FOUND", { message: "Memória não encontrada." });

    await prisma.$transaction(async (tx) => {
      // Duas regras com a mesma chave se contradizem: ativar uma arquiva a outra.
      if (input.status === "ACTIVE" && memory.ruleKey) {
        await tx.astroMemory.updateMany({
          where: {
            organizationId: context.org.id,
            ruleKey: memory.ruleKey,
            status: "ACTIVE",
            id: { not: memory.id },
          },
          data: { status: "ARCHIVED" },
        });
      }
      await tx.astroMemory.update({
        where: { id: memory.id },
        data: {
          status: input.status,
          ...(input.status === "ACTIVE" ? { approvedById: context.user.id } : {}),
        },
      });
    });
    return { id: memory.id, status: input.status };
  });

const deleteMemory = orgProcedure
  .input(z.object({ memoryId: z.string() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const memory = await prisma.astroMemory.findFirst({
      where: { id: input.memoryId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!memory) throw new ORPCError("NOT_FOUND", { message: "Memória não encontrada." });
    await prisma.astroMemory.delete({ where: { id: memory.id } });
    return { id: memory.id };
  });

// ── Feedback ──────────────────────────────────────────────────────────────

const listFeedback = orgProcedure
  .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
  .handler(async ({ context, input }) => {
    const feedbacks = await prisma.astroFeedback.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      take: input?.limit ?? 20,
      select: {
        id: true,
        rating: true,
        correction: true,
        answerExcerpt: true,
        processedAt: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
    return {
      feedbacks: feedbacks.map((feedback) => ({
        ...feedback,
        rating: toFeedbackRating(feedback.rating),
      })),
    };
  });

const sendFeedback = orgProcedure
  .input(
    z.object({
      rating: z.enum(["UP", "DOWN"]),
      sessionId: z.string().optional(),
      messageId: z.string().optional(),
      correction: z.string().trim().max(1000).optional(),
      answerExcerpt: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, input }) =>
    recordAstroFeedback({ organizationId: context.org.id, userId: context.user.id, ...input }),
  );

export const astroIntelligenceRouter = {
  knowledge: {
    list: listKnowledge,
    get: getKnowledge,
    save: saveKnowledge,
    delete: deleteKnowledge,
  },
  memories: {
    list: listMemories,
    create: createMemory,
    setStatus: setMemoryStatus,
    delete: deleteMemory,
  },
  feedback: {
    list: listFeedback,
    send: sendFeedback,
  },
};
