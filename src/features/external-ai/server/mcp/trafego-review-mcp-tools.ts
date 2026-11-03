import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { orderReviewFixesSchema } from "@/features/trafego/lib/order-review";
import { findOrderIdByCode, listOrderReviewQueue, recordOrderReview } from "@/features/trafego/server/lib/order-review";
import { markOrderPublished } from "@/features/trafego/server/lib/order-review-actions";
import { loadOrderForReview } from "@/features/trafego/server/lib/order-review-draft";
import type { ExternalAiCaller } from "../access-tokens";
import { asResult, guardTrafegoTool, type ToolResult } from "./trafego-mcp-tools";

/**
 * Avaliar e publicar pela rotina do Claude (spec 0132, RF-7). O ÓRBITA só lê e grava o próprio banco: a
 * campanha é criada e ativada pelo MCP da Meta da equipe, e só para pedido que o cliente liberou.
 */

const QUEUE_LIMIT = 20;

export function registerTrafegoReviewMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "trafego_list_review_queue",
    {
      description:
        "Fila da rotina de 2 em 2 horas: toReview (pedidos completos esperando sua avaliação) e toPublish (aprovados e liberados pelo cliente, no dia de começar). Comece por aqui.",
      inputSchema: {},
    },
    () => guardTrafegoTool(caller, async () => asResult(await listOrderReviewQueue(QUEUE_LIMIT))),
  );

  server.registerTool(
    "trafego_get_order_for_review",
    {
      description:
        "Tudo o que o pedido vai mandar para a Meta: texto, título, mensagem inicial do WhatsApp, público, verba, prazo, orientação e análise do Astro, histórico da conta, as regras e o criativo como imagem. Devolve o fingerprint, obrigatório em trafego_review_order.",
      inputSchema: { code: z.string().describe("Código do pedido, ex.: TG-0042") },
    },
    ({ code }) =>
      guardTrafegoTool(caller, async (): Promise<ToolResult> => {
        const review = await loadOrderForReview(await findOrderIdByCode(code));
        return {
          content: [
            { type: "text", text: JSON.stringify(review.data, null, 2) },
            ...review.images.map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType })),
          ],
        };
      }),
  );

  server.registerTool(
    "trafego_review_order",
    {
      description:
        "Grava a avaliação. approved: o cliente vê \"Aprovado, publicar\". changes: ele vê \"Avaliar melhorias e aprovar\" com fixes (o painel grava sozinho) e notes (o cliente resolve). summary em linguagem simples, para o dono do negócio. O cliente é avisado por WhatsApp.",
      inputSchema: {
        code: z.string(),
        fingerprint: z.string().min(8).describe("O fingerprint devolvido por trafego_get_order_for_review"),
        verdict: z.enum(["approved", "changes"]),
        summary: z.string().min(10).max(1000),
        fixes: orderReviewFixesSchema.optional().describe("Só message, headline, initialMessage, audience"),
        notes: z.array(z.string().min(3).max(300)).max(10).optional().describe("O que o cliente resolve sozinho"),
      },
    },
    ({ code, fingerprint, verdict, summary, fixes, notes }) =>
      guardTrafegoTool(caller, async () =>
        asResult(
          await recordOrderReview({
            orderId: await findOrderIdByCode(code),
            fingerprint,
            verdict,
            summary,
            fixes,
            notes,
            actorUserId: caller.userId,
            viaLabel: caller.label,
          }),
        ),
      ),
  );

  server.registerTool(
    "trafego_mark_published",
    {
      description:
        "Depois de criar e ativar a campanha pelo MCP da Meta (com o roteiro de trafego_get_publish_brief): confere que o cliente liberou e que o pedido não mudou, vincula a campanha e marca o pedido como no ar, avisando o cliente. Se recusar, pause a campanha na Meta.",
      inputSchema: {
        code: z.string(),
        metaCampaignId: z.string().regex(/^\d{6,25}$/, "Use o id numérico da campanha"),
      },
    },
    ({ code, metaCampaignId }) =>
      guardTrafegoTool(caller, async () =>
        asResult(
          await markOrderPublished({
            orderId: await findOrderIdByCode(code),
            metaCampaignId,
            actorUserId: caller.userId,
            viaLabel: caller.label,
          }),
        ),
      ),
  );
}
