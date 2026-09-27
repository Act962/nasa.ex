import { createHmac, randomBytes, randomUUID } from "node:crypto";
import prisma from "../../../src/lib/prisma";
import type { QaOrgContext } from "../qa-org";

// ASTRO pela rota HTTP real (/api/astro/chat), onde mora a cobrança (F10).
// Autentica como o Vendedor QA — usuário só de teste, sem senha — com uma
// sessão curta gravada direto no banco. Nunca usa a conta do dono.

const APP_URL = process.env.ASTRO_QA_APP_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "better-auth.session_token";
const SESSION_TTL_MS = 60 * 60_000;

function signSessionToken(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET ausente: não dá para assinar a sessão de teste.");
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return encodeURIComponent(`${token}.${signature}`);
}

export interface HttpAstroReply {
  status: number;
  text: string;
  /** Saídas de ferramenta no stream (cartões, tabelas). */
  toolOutputs: unknown[];
  /** Id do cartão pendente, quando a resposta é um cartão de confirmação. */
  pendingActionId?: string;
  error?: string;
}

interface StreamPart {
  type?: string;
  delta?: string;
  output?: unknown;
}

function readPendingActionId(outputs: unknown[]): string | undefined {
  for (const output of outputs) {
    const candidate = output as { proposalId?: unknown; pendingActionId?: unknown; id?: unknown; requiresConfirmation?: unknown } | null;
    const id = candidate?.proposalId ?? candidate?.pendingActionId;
    if (typeof id === "string") return id;
  }
  return undefined;
}

export class HttpAstroSession {
  private readonly history: { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[] = [];

  private constructor(
    private readonly cookie: string,
    readonly aiSessionId: string,
    readonly authSessionId: string,
  ) {}

  static async open(qaOrg: QaOrgContext): Promise<HttpAstroSession> {
    const token = randomBytes(24).toString("base64url");
    const authSession = await prisma.session.create({
      data: {
        token,
        userId: qaOrg.sellerUserId,
        activeOrganizationId: qaOrg.organizationId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: "astro-qa",
      },
      select: { id: true },
    });
    const aiSession = await prisma.aiSession.create({
      data: { organizationId: qaOrg.organizationId, userId: qaOrg.sellerUserId, title: "QA F10" },
      select: { id: true },
    });
    return new HttpAstroSession(`${SESSION_COOKIE}=${signSessionToken(token)}`, aiSession.id, authSession.id);
  }

  async send(text: string): Promise<HttpAstroReply> {
    this.history.push({ id: randomUUID(), role: "user", parts: [{ type: "text", text }] });
    const response = await fetch(`${APP_URL}/api/astro/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie, origin: APP_URL },
      body: JSON.stringify({ sessionId: this.aiSessionId, messages: this.history, context: {} }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      const body = JSON.parse(responseText || "{}") as { error?: string };
      return { status: response.status, text: "", toolOutputs: [], error: body.error ?? responseText.slice(0, 200) };
    }
    let replyText = "";
    const toolOutputs: unknown[] = [];
    for (const line of responseText.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const part = JSON.parse(line.slice(6)) as StreamPart;
      if (part.type === "text-delta" && part.delta) replyText += part.delta;
      if (part.type === "tool-output-available") toolOutputs.push(part.output);
    }
    this.history.push({ id: randomUUID(), role: "assistant", parts: [{ type: "text", text: replyText }] });
    return { status: response.status, text: replyText, toolOutputs, pendingActionId: readPendingActionId(toolOutputs) };
  }

  async close(): Promise<void> {
    await prisma.session.deleteMany({ where: { id: this.authSessionId } });
    await prisma.aiSession.deleteMany({ where: { id: this.aiSessionId } });
  }
}
