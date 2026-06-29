/**
 * Procedure oRPC `agents.webSearch` — busca na web via Gemini Grounding /
 * OpenAI search-preview. Usada pelo botão "+ Pesquisar na Web" no composer
 * do chat (`footer-chat.tsx`).
 *
 * Reusa o executor `webSearchExecutor` que o nó WEB_SEARCH do canvas
 * também usa — mesma cobrança em Stars, mesmo fallback de provider.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { webSearchExecutor } from "@/features/workflows/lib/agent-executors/web-search";
import { createInitialContext } from "@/features/workflows/lib/workflow-context";
import prisma from "@/lib/prisma";
import z from "zod";

export const webSearchProcedure = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      query: z.string().min(2).max(500),
      provider: z.enum(["gemini", "openai"]).optional(),
      /** Org pra cobrar Stars. Frontend pega do contexto atual. */
      organizationId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    // Valida que o user tem acesso à org (mesmo padrão dos outros handlers)
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada" });
    }

    const result = await webSearchExecutor({
      nodeId: "chat-composer-websearch",
      nodeType: "WEB_SEARCH",
      data: {
        query: input.query,
        organizationId: input.organizationId,
        preferredProvider: input.provider ?? "gemini",
      },
      context: createInitialContext({ initialVars: {} }),
      dryRun: false,
    });

    if (result.status === "FAILED") {
      throw errors.INTERNAL_SERVER_ERROR({
        message: result.errorMessage ?? "Web search falhou",
      });
    }

    const output = result.output as {
      summary?: string;
      sources?: Array<{ title: string; url: string; snippet: string }>;
      provider?: string;
    };

    return {
      summary: output.summary ?? "",
      sources: output.sources ?? [],
      provider: output.provider ?? "unknown",
      starsSpent: result.starsSpent ?? 0,
    };
  });
