import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * "Criar com Planner" (antigo "Adicionar ao Planner") — gera um novo
 * `NasaPlannerPost` a partir de uma `Action` do Workspace.
 *
 * NASA Planner 2.0 estende essa procedure pra:
 *  1. Copiar `action.description` → `post.caption` (legenda opcional do
 *     post fica pré-preenchida com o contexto do card de evento).
 *  2. Persistir `actionId` no post — vínculo bidirecional. O popup do
 *     Planner ancorado em `view-action-modal` usa esse FK pra encontrar
 *     posts existentes vinculados ao card e exibir na aba Posts.
 *  3. Stripar markdown/HTML básico da description (rich-text → texto
 *     puro) — caption do IG não aceita HTML.
 *
 * NÃO copia anexos automaticamente — o popup do Planner SUGERE os
 * anexos do action como referências de mídia, mas é decisão do usuário
 * aplicar ou não. Mantém controle do que vira post público.
 */

/**
 * Converte rich text (TipTap-style HTML ou markdown leve) em texto puro
 * adequado pra caption do Instagram/Facebook. Não preserva formatação —
 * só extrai o conteúdo legível, respeitando quebras de linha de blocos.
 */
function stripRichTextToPlain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    // Quebras de linha pra <br> e fim de bloco
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    // Remove restantes das tags
    .replace(/<[^>]+>/g, "")
    // Decode entidades comuns
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Markdown leve: bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Colapsa whitespace múltiplo (mantém max 2 quebras consecutivas)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const createPostFromAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      plannerId: z.string(),
      type: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).default("STATIC"),
      targetNetworks: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const [action, planner] = await Promise.all([
      prisma.action.findFirst({
        where: { id: input.actionId, organizationId: context.org.id },
        select: { id: true, title: true, description: true },
      }),
      prisma.nasaPlanner.findFirst({ where: { id: input.plannerId, organizationId: context.org.id } }),
    ]);

    if (!action) throw new ORPCError("NOT_FOUND", { message: "Card não encontrado" });
    if (!planner) throw new ORPCError("NOT_FOUND", { message: "Planner não encontrado" });

    // Auto-popula caption a partir da description do action (limpa de HTML/markdown).
    const captionFromAction = stripRichTextToPlain(action.description);
    // Limite IG: 2200 chars. Truncamos com reticências se exceder.
    const caption =
      captionFromAction.length > 2200
        ? `${captionFromAction.slice(0, 2197)}...`
        : captionFromAction || null;

    const post = await prisma.nasaPlannerPost.create({
      data: {
        plannerId: input.plannerId,
        organizationId: context.org.id,
        createdById: context.user.id,
        title: action.title,
        caption,
        actionId: action.id,
        type: input.type as any,
        targetNetworks: input.targetNetworks ?? [],
        referenceLinks: [],
      },
    });

    return { post };
  });
