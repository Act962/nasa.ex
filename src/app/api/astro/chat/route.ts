import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { UIMessage } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { streamAstro } from "@/features/astro/server/orchestrator";
import { astroChatRequestSchema } from "@/features/astro/schemas/chat-message";
import type { AgentKey } from "@/features/astro/schemas/agent-config";

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

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      console.error("[ASTRO/chat] stream error", err);
      return err instanceof Error ? err.message : String(err);
    },
    onFinish: async ({ messages: finalMessages, isAborted }) => {
      console.log(
        `[ASTRO/chat] stream finish (aborted=${isAborted}, n=${finalMessages.length})`,
      );
      if (isAborted) return;
      const firstUserMsg = finalMessages.find((m) => m.role === "user");
      const titleSrc =
        firstUserMsg && Array.isArray((firstUserMsg as any).parts)
          ? (firstUserMsg as any).parts
              .filter((p: any) => p?.type === "text")
              .map((p: any) => p.text)
              .join(" ")
          : "";
      const autoTitle =
        titleSrc.trim().slice(0, 60) || "Conversa com ASTRO";

      await prisma.aiSession.update({
        where: { id: sessionId },
        data: {
          messages: finalMessages as unknown as object,
          // Auto-título só na primeira persistência
          title: autoTitle,
        },
      });
    },
  });
}
