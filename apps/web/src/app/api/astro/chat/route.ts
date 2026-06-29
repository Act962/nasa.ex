import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { UIMessage } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { streamAstro } from "@/features/astro/server/orchestrator";
import { astroChatRequestSchema } from "@/features/astro/schemas/chat-message";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { debitStars } from "@/features/stars/lib/star-service";
import { generateAutoTitle } from "@/features/astro/lib/auto-title";

/**
 * Ratio de cobrança em Stars por tokens consumidos pelo Astro.
 * 1 Star = 1000 tokens (qualquer tipo — input + output agregados).
 *
 * Justificativa: GPT-4o-mini cobra ~$0.15/1M input + $0.60/1M output.
 * 1000 tokens ≈ $0.00015 (só input) ou $0.0006 (só output).
 * 1 Star tem valor maior que isso → margem positiva.
 *
 * Pra recalibrar: ajuste só esse número. Cobrança é silenciosa (não
 * mostra valor pro user, só debita).
 */
const STARS_PER_1K_TOKENS = 1;

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/astro/chat
 *
 * Endpoint do copiloto. Consumido pelo `useChat` do `@ai-sdk/react` em todas
 * as superfícies do ASTRO (widget global, fullscreen em /home, embeds).
 *
 * Body:
 *   - messages:        UIMessage[] (gerenciado pelo useChat)
 *   - sessionId?:      hidrata e atualiza uma AiSession existente
 *   - context?:        snapshot da rota (orgId/leadId/etc) — vai para o ctx
 *                      do orquestrador e fica no `AiSession.context`
 *   - pinnedAgentKey?: força um sub-agente (usado pelos embeds)
 *
 * Persistência:
 *   - Cria `AiSession` se não houver sessionId.
 *   - No `onFinish` do stream, atualiza `messages` + `lastAgentKey` + `title`.
 *
 * Retorna:
 *   - UI message stream do AI SDK (`toUIMessageStreamResponse`).
 */
export async function POST(req: Request) {
  console.log("[ASTRO/chat] POST start");
  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user || !sessionData.session.activeOrganizationId) {
    console.warn("[ASTRO/chat] no session/org");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = sessionData.user.id;
  const organizationId = sessionData.session.activeOrganizationId;

  const rawBody = await req.json().catch((e) => {
    console.error("[ASTRO/chat] req.json failed", e);
    return null;
  });
  if (!rawBody) {
    return NextResponse.json({ error: "Body ausente" }, { status: 400 });
  }
  console.log("[ASTRO/chat] body keys:", Object.keys(rawBody), {
    sessionId: rawBody.sessionId,
    nMessages: Array.isArray(rawBody.messages) ? rawBody.messages.length : -1,
    pinnedAgentKey: rawBody.pinnedAgentKey,
  });

  let parsed;
  try {
    parsed = astroChatRequestSchema.parse(rawBody);
  } catch (e) {
    console.error("[ASTRO/chat] schema parse failed", e);
    return NextResponse.json(
      { error: "Body inválido", detail: String(e) },
      { status: 400 },
    );
  }

  const uiMessages = parsed.messages as unknown as UIMessage[];

  // O cliente DEVE criar a sessão via `orpc.astro.sessions.create` antes de
  // chamar este endpoint — assim mantemos o fluxo do AI SDK simples (sem
  // truques de header/data-part para devolver o id). Validamos posse aqui.
  const sessionId = parsed.sessionId;
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId obrigatório (chame astro.sessions.create primeiro)" },
      { status: 400 },
    );
  }
  const existing = await prisma.aiSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, organizationId: true },
  });
  if (
    !existing ||
    existing.userId !== userId ||
    existing.organizationId !== organizationId
  ) {
    return NextResponse.json(
      { error: "Sessão não encontrada" },
      { status: 404 },
    );
  }

  // ── Cobrança de Stars (regra global em AppStarCost: "astro_prompt") ─────
  // Custo fixo de "stake" por prompt — garante que o user tem saldo antes
  // de gerar resposta. Cobrança proporcional aos tokens reais é feita no
  // onFinish abaixo (silenciosa, sem expor valor pro user).
  // Custo zero ou regra ausente = não cobra fixo. Saldo insuficiente = 402.
  try {
    const charge = await chargeStarsByAction(organizationId, "astro_prompt", {
      userId,
      description: "Astro IA — prompt (stake)",
      appSlug: "astro",
    });
    if (!charge.skipped && !charge.success) {
      return NextResponse.json(
        {
          error:
            "Saldo de Stars insuficiente pra usar o Astro. Recarregue ou ajuste o plano.",
        },
        { status: 402 },
      );
    }
  } catch (e) {
    console.error("[ASTRO/chat] charge failed (continuing)", e);
  }

  let result;
  try {
    result = await streamAstro({
      ctx: {
        userId,
        organizationId,
        route: parsed.context ?? {},
        pinnedAgentKey: parsed.pinnedAgentKey as AgentKey | undefined,
      },
      uiMessages,
    });
  } catch (e) {
    console.error("[ASTRO/chat] streamAstro setup failed", e);
    return NextResponse.json(
      { error: "Falha ao iniciar o orquestrador", detail: String(e) },
      { status: 500 },
    );
  }

  // Captura usage de tokens do stream pra:
  //  1) anexar como metadata da última UIMessage (cliente exibe "245 tokens")
  //  2) cobrar Stars proporcional no onFinish (silencioso)
  let capturedTokens = 0;

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      console.error("[ASTRO/chat] stream error", err);
      return err instanceof Error ? err.message : String(err);
    },
    // Anexa { tokens } na última mensagem do stream (event "finish" do AI SDK).
    // Cliente lê em `message.metadata.tokens` e renderiza no rodapé.
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        const usage = (part as { totalUsage?: { totalTokens?: number } })
          .totalUsage;
        const tokens = usage?.totalTokens ?? 0;
        if (tokens > 0) {
          capturedTokens = tokens;
          return { tokens };
        }
      }
      return undefined;
    },
    onFinish: async ({ messages: finalMessages, isAborted }) => {
      console.log(
        `[ASTRO/chat] stream finish (aborted=${isAborted}, n=${finalMessages.length}, tokens=${capturedTokens})`,
      );
      if (isAborted) return;

      // ── Cobrança extra por tokens consumidos ─────────────────────────
      // Convertida pra Stars via STARS_PER_1K_TOKENS. Não mostramos valor
      // pro user — só registramos a transação. Falha silenciosa: se debit
      // não passar, mantém o fluxo (já cobrou o stake no início).
      if (capturedTokens > 0) {
        const starsToCharge = Math.max(
          1,
          Math.round((capturedTokens / 1000) * STARS_PER_1K_TOKENS),
        );
        try {
          await debitStars(
            organizationId,
            starsToCharge,
            "APP_CHARGE",
            `Astro IA — ${capturedTokens.toLocaleString("pt-BR")} tokens`,
            "astro",
            userId,
            { allowBonus: true },
          );
        } catch (e) {
          // Saldo insuficiente etc. — só loga, não bloqueia a resposta
          // (já entregamos ao user). Próximo prompt vai falhar no stake.
          console.warn("[ASTRO/chat] token charge failed:", e);
        }
      }

      const firstUserMsg = finalMessages.find((m) => m.role === "user");
      const titleSrc =
        firstUserMsg && Array.isArray((firstUserMsg as any).parts)
          ? (firstUserMsg as any).parts
              .filter((p: any) => p?.type === "text")
              .map((p: any) => p.text)
              .join(" ")
          : "";
      const autoTitle = generateAutoTitle(titleSrc);

      // Só atualiza o título se a sessão ainda não tem um — assim o user
      // pode renomear (via /astro/sessions/update-title) sem ser
      // sobrescrito a cada nova mensagem.
      const current = await prisma.aiSession.findUnique({
        where: { id: sessionId },
        select: { title: true },
      });
      const shouldSetTitle =
        !current?.title || current.title === "Conversa com ASTRO";

      await prisma.aiSession.update({
        where: { id: sessionId },
        data: {
          messages: finalMessages as unknown as object,
          ...(shouldSetTitle ? { title: autoTitle } : {}),
        },
      });
    },
  });
}
