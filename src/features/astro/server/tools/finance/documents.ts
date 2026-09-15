import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { extractFinancialDocument } from "@/features/payment/server/documents/extract-financial-document";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";

// Leitura de boleto/NF anexado (spec 0014, RF-6). O retorno é pro modelo
// montar a proposta — não é renderizado como card.

export function buildFinanceDocumentTools(ctx: AgentContext) {
  return {
    read_financial_document: tool({
      description:
        "LÊ um documento financeiro anexado (boleto, nota fiscal, NFS-e, fatura, recibo — PDF ou imagem) e devolve: tipo, direção (a pagar/a receber), emissor e pagador com CNPJ, valor em centavos, vencimento, número do documento, dados do boleto (linha digitável validada) ou da NF (chave, parcelas), descrição sugerida, confiança, avisos, contato correspondente já cadastrado e possíveis lançamentos duplicados. Chame SEMPRE que houver [ARQUIVOS ANEXADOS] e o usuário quiser lançar/ler/'dar entrada'. Cobra 5★ na primeira leitura; releitura do mesmo anexo é grátis.",
      inputSchema: z.object({
        attachmentId: z.string().describe("ID do anexo (vem em [ARQUIVOS ANEXADOS] ou em list_payment_documents)."),
        force: z.boolean().optional().describe("Relê o arquivo ignorando o cache (cobra de novo). Só se o usuário pedir."),
      }),
      execute: async ({ attachmentId, force }) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "create");
        if (!access.ok) return { error: access.error };

        const result = await extractFinancialDocument({
          organizationId: ctx.organizationId,
          attachmentId,
          userId: ctx.userId,
          force,
        });
        if (!result.ok) return { error: result.message, reason: result.reason };

        const extraction = result.extraction;
        const suggestedType =
          extraction.direction === "UNKNOWN" ? null : extraction.direction;
        const nextStep =
          extraction.direction === "UNKNOWN"
            ? "Pergunte ao usuário se este documento é uma conta A PAGAR ou A RECEBER antes de propor."
            : extraction.amountCents === null || extraction.dueDate === null
              ? "Falta valor ou vencimento: pergunte ao usuário antes de propor."
              : `Chame propose_payment_entry com type=${suggestedType}, amountCents=${extraction.amountCents}, dueDateIso=${extraction.dueDate}, attachmentId=${attachmentId}${extraction.contactMatch ? `, contactId=${extraction.contactMatch.contactId}` : ", newContact com nome/documento do emissor"}.`;

        return {
          attachmentId,
          fromCache: result.fromCache,
          documentType: extraction.documentType,
          direction: extraction.direction,
          issuer: extraction.issuer,
          payer: extraction.payer,
          amountCents: extraction.amountCents,
          amountFormatted: extraction.amountCents !== null ? formatBRL(extraction.amountCents) : null,
          dueDate: extraction.dueDate,
          dueDateFormatted: formatDateBR(extraction.dueDate),
          issueDate: extraction.issueDate,
          documentNumber: extraction.documentNumber,
          boleto: extraction.boleto,
          invoice: extraction.invoice,
          description: extraction.description,
          confidence: extraction.confidence,
          warnings: extraction.warnings,
          validation: extraction.validation,
          contactMatch: extraction.contactMatch,
          possibleDuplicates: extraction.possibleDuplicates,
          suggestedNextStep: nextStep,
        };
      },
    }),
  };
}
