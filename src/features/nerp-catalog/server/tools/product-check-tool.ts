// Spec 0104, RF-20: "quanto custa esse?" vira consulta ao coordenador; o Astro não inventa preço nem estoque.
import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { requestProductCheck } from "../../lib/approvals/product-check";

export const PRODUCT_CHECK_REPLY = "Tranquilo. Já te mando o valor aqui, só conferindo estoque e preço.";

export function makeProductCheckTool(ctx: { organizationId: string; trackingId: string; leadId: string; conversationId: string }) {
  return tool({
    description: `Cliente perguntou preço, estoque ou se tem um produto (por texto ou foto) que ainda não tem valor enviado pela equipe. Aciona o coordenador para orçar. Responda ao cliente só: "${PRODUCT_CHECK_REPLY}" — nunca invente preço nem estoque.`,
    inputSchema: z.object({
      produto: z.string().min(2).describe('O que o cliente pediu, com marca/tamanho se houver (ex.: "absorvente Delicacy noturno com abas, 8 un.")'),
      temFoto: z.boolean().describe("O cliente mandou foto do produto"),
    }),
    execute: async ({ produto, temFoto }) => {
      const { notifiedCount } = await requestProductCheck({ ...ctx, request: produto, hasPhoto: temFoto });
      return { ok: true, coordinatorNotified: notifiedCount > 0, replyToCustomer: PRODUCT_CHECK_REPLY };
    },
  });
}
