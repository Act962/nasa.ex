import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { resolveAnthropicApiKey } from "@/lib/anthropic-key";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Lê um arquivo (PDF ou imagem) já subido pro S3/R2 e usa Claude Vision
 * pra extrair:
 *  - `valueCents`: VALOR TOTAL GERAL em centavos
 *  - `description`: resumo curto (1-2 frases em PT-BR)
 *  - `confidence`: high / medium / low
 *  - `isProposalLike`: true se o documento tem aparência de
 *    proposta/OS/orçamento (lista de itens + valor + dados de cliente)
 *
 * Usada por:
 *  1. `BudgetPanel` (Chat → "+") — após upload via "Adicione o Orçamento
 *     aqui", auto-preenche Valor e Descrição.
 *  2. `FooterChat` (anexo regular) — quando o consultor sobe um PDF/imagem,
 *     detecta se é proposta e oferece converter pro fluxo de Orçamento
 *     (pra capturar métricas em vez de só enviar o anexo).
 *
 * Mesmo padrão de `extract-event-from-image` (Claude Haiku 4.5 + AI SDK
 * `generateObject` com schema Zod) — output JSON estruturado garantido
 * pelo modelo.
 */

const budgetSchema = z.object({
  valueCents: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe(
      "Valor TOTAL GERAL em centavos (sem subtotais nem itens individuais). " +
        "Procure por 'Total Geral', 'Valor Total', 'Total a Pagar'. Use null " +
        "se não houver valor monetário identificável.",
    ),
  description: z
    .string()
    .max(500)
    .describe(
      "Resumo curto de 1-2 frases em português identificando: tipo do " +
        "documento (orçamento/OS/proposta), número se houver, e os 2-3 " +
        "itens/serviços principais. Máximo 300 caracteres. Sem markdown.",
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "'high' se o valor está explicitamente como Total Geral; 'medium' se " +
        "foi inferido de subtotais; 'low' se foi estimativa ou o documento " +
        "está com qualidade ruim.",
    ),
  isProposalLike: z
    .boolean()
    .describe(
      "true se o documento tem características de orçamento/OS/proposta/" +
        "cotação comercial (valores monetários + lista de itens/serviços + " +
        "dados de cliente ou empresa). false pra contratos, recibos, fotos " +
        "casuais, comprovantes, etc.",
    ),
});

export type ExtractedBudget = z.infer<typeof budgetSchema>;

export const extractBudget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Extract budget data from a PDF or image uploaded to S3",
    tags: ["IA", "Payment"],
  })
  .input(
    z.object({
      fileKey: z
        .string()
        .min(1)
        .describe("Chave S3/R2 do arquivo já subido (PDF ou imagem)"),
    }),
  )
  .output(
    z.object({
      valueCents: z.number().int().positive().nullable(),
      description: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      isProposalLike: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const apiKey = await resolveAnthropicApiKey(context.org.id);
    if (!apiKey) {
      throw errors.FORBIDDEN({
        message:
          "IA não configurada — peça pro admin configurar a chave Anthropic em Configurações da Organização.",
      });
    }

    // 1) Baixar o arquivo do S3/R2.
    let bytes: Uint8Array;
    let mediaType: string;
    try {
      const cmd = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: input.fileKey,
      });
      const res = await S3.send(cmd);
      if (!res.Body) {
        throw new Error("Arquivo vazio no storage");
      }
      // res.Body é um Readable/ReadableStream — coletamos como bytes.
      const chunks: Uint8Array[] = [];
      // @ts-expect-error — AWS SDK Body é AsyncIterable<Uint8Array> no Node
      for await (const chunk of res.Body) {
        chunks.push(chunk as Uint8Array);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      mediaType =
        res.ContentType ||
        // Fallback: detecta pela extensão da key.
        (input.fileKey.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : input.fileKey.toLowerCase().endsWith(".png")
            ? "image/png"
            : input.fileKey.toLowerCase().endsWith(".webp")
              ? "image/webp"
              : "image/jpeg");
    } catch (err) {
      console.error("[ia.extractBudget] failed to fetch file from S3", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Não consegui ler o arquivo do storage. Tente subir de novo.",
      });
    }

    // 2) Chamar Claude Vision via AI SDK. PDF e imagem são suportados
    //    nativamente pelo Claude — `type: "file"` pra PDF, `type: "image"`
    //    pra imagens.
    const anthropic = createAnthropic({ apiKey });
    const isPdf = mediaType.includes("pdf");

    try {
      const { object } = await generateObject({
        model: anthropic("claude-haiku-4-5-20251001"),
        schema: budgetSchema,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "extract-budget",
          metadata: { posthog_distinct_id: context.user.id },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analise este documento (PDF, imagem ou foto) e extraia os " +
                  "dados no schema fornecido. O documento pode ser uma Ordem " +
                  "de Serviço (OS), orçamento, cotação ou proposta comercial " +
                  "brasileira. Procure o VALOR TOTAL GERAL (não subtotais) e " +
                  "monte uma descrição curta em português mencionando os " +
                  "principais itens/serviços. Use null em valueCents se o " +
                  "documento não tem valor monetário claro (ex: foto, " +
                  "contrato sem preço).",
              },
              isPdf
                ? {
                    type: "file",
                    data: bytes,
                    mediaType: "application/pdf",
                  }
                : {
                    type: "image",
                    image: bytes,
                    mediaType,
                  },
            ],
          },
        ],
        maxOutputTokens: 600,
      });

      return {
        valueCents: object.valueCents,
        description: object.description,
        confidence: object.confidence,
        isProposalLike: object.isProposalLike,
      };
    } catch (err) {
      console.error("[ia.extractBudget] AI call failed", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "Falha ao processar o arquivo com a IA. Preencha os campos manualmente.",
      });
    }
  });
