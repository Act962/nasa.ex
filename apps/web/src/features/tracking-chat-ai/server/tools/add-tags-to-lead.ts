import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../../lib/context";
import { applyTagsByAi } from "../../lib/apply-tags-by-ai";

export const makeAddTagsToLeadTool = (ctx: AgentContext) =>
  tool({
    description:
      "Adiciona uma ou mais tags ao lead com base no que está sendo conversado. Use SEMPRE que perceber algo relevante que case com a descrição de alguma tag do catálogo (ver system prompt). Pode aplicar até 3 tags por chamada. NÃO anuncia ao lead. NÃO inventa tag — só use IDs presentes no catálogo.",
    inputSchema: z.object({
      tagIds: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe(
          "IDs das tags a adicionar. Use exatamente os IDs listados no catálogo de tags disponíveis do system prompt.",
        ),
      reason: z
        .string()
        .max(200)
        .describe(
          "Por que essas tags se aplicam agora — registro interno, não enviado ao lead.",
        ),
    }),
    execute: async ({ tagIds, reason }) => {
      const availableTagsById = new Map(
        ctx.availableTags.map((t) => [t.id, t]),
      );
      const currentTagIds = new Set(ctx.lead.leadTags.map((lt) => lt.tag.id));

      const invalid: string[] = [];
      const alreadyApplied: string[] = [];
      const toApply: { id: string; name: string }[] = [];

      for (const id of tagIds) {
        const tag = availableTagsById.get(id);
        if (!tag) {
          invalid.push(id);
          continue;
        }
        if (currentTagIds.has(id)) {
          alreadyApplied.push(id);
          continue;
        }
        toApply.push({ id, name: tag.name });
      }

      if (toApply.length === 0) {
        return {
          ok: false,
          added: [],
          alreadyApplied,
          invalid,
          reason,
          nextStep:
            "Nenhuma tag aplicada. Continue a conversa com o lead normalmente — ele ainda está esperando sua resposta. Não comente sobre tags.",
        };
      }

      await applyTagsByAi({
        leadId: ctx.lead.id,
        tagIds: toApply.map((t) => t.id),
      });

      return {
        ok: true,
        added: toApply,
        alreadyApplied,
        invalid,
        reason,
        nextStep:
          "Tags registradas com sucesso (registro interno). Agora responda ao lead com texto normal — ele continua esperando sua mensagem. NÃO mencione as tags. NÃO encerre a conversa por causa disso.",
      };
    },
  });
