import { randomInt } from "node:crypto";
import prisma from "../../../src/lib/prisma";
import type { QaOrgContext } from "../qa-org";
import { hashVisitorToken } from "../../../src/features/astro-chat/lib/keys";

// Visitante do ASTRO CHAT pela API pública real, via HTTP no servidor local
// (F8-SITE). Passa pelo portão de origem (CORS), pelo limite de mensagens e
// pelo agente de verdade, que responde pelo Inngest.

export const QA_SITE_PUBLIC_KEY = "ac_pk_astroqa_site_000001";
export const QA_SITE_ORIGIN = "https://qa.orbita.test";
const APP_URL = process.env.ASTRO_QA_APP_URL ?? "http://localhost:3000";
/** O limite do site é uma mensagem a cada 2 s por visitante. */
const MESSAGE_PACING_MS = 2200;
const REPLY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2000;

/** Site de QA ligado ao funil Vendas e ao conhecimento da massa. Refeito a cada caso (a massa é recriada). */
export async function ensureQaSite(qaOrg: QaOrgContext) {
  const [tracking, knowledge] = await Promise.all([
    prisma.tracking.findFirstOrThrow({
      where: { organizationId: qaOrg.organizationId, name: "Vendas" },
      select: { id: true },
    }),
    prisma.aiKnowledge.findMany({ where: { organizationId: qaOrg.organizationId }, select: { id: true } }),
  ]);
  const data = {
    organizationId: qaOrg.organizationId,
    name: "Site QA",
    trackingId: tracking.id,
    statusId: null,
    allowedOrigins: [QA_SITE_ORIGIN],
    isEnabled: true,
    pausedReason: null,
    aiEnabled: true,
    knowledgeIds: knowledge.map((item) => item.id),
    blockedTopicIds: [],
    restrictionNotes: "Desconto máximo de 10%. Nunca prometa desconto maior.",
  };
  return prisma.astroChatSite.upsert({
    where: { publicKey: QA_SITE_PUBLIC_KEY },
    create: { ...data, publicKey: QA_SITE_PUBLIC_KEY, createdById: qaOrg.ownerUserId },
    update: data,
  });
}

function randomTestIp(): string {
  return `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface SiteMessage {
  id: string;
  body: string;
  author: "visitor" | "astro" | "team";
  createdAt: string;
}

export class SiteVisitor {
  private lastSentAt = 0;
  private lastSeenMessageId: string | null = null;

  private constructor(
    private readonly token: string,
    private readonly ip: string,
    private readonly origin: string,
  ) {}

  /** Abre a sessão como um navegador no site cadastrado (ou em outra origem, para o CORS). */
  static async open(origin = QA_SITE_ORIGIN): Promise<{ visitor: SiteVisitor | null; status: number; error?: string }> {
    const ip = randomTestIp();
    const response = await fetch(`${APP_URL}/api/astro-chat/${QA_SITE_PUBLIC_KEY}/session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, "x-forwarded-for": ip },
      body: JSON.stringify({ pageUrl: `${origin}/` }),
    });
    const body = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!response.ok || !body.token) return { visitor: null, status: response.status, error: body.error };
    return { visitor: new SiteVisitor(body.token, ip, origin), status: response.status };
  }

  private headers() {
    return {
      "content-type": "application/json",
      origin: this.origin,
      "x-forwarded-for": this.ip,
      "x-astro-visitor": this.token,
    };
  }

  /** Só envia, sem esperar a resposta — para o teste de limite. */
  async post(text: string, options: { respectPacing?: boolean } = {}): Promise<number> {
    if (options.respectPacing !== false) {
      const wait = this.lastSentAt + MESSAGE_PACING_MS - Date.now();
      if (wait > 0) await delay(wait);
    }
    this.lastSentAt = Date.now();
    const response = await fetch(`${APP_URL}/api/astro-chat/${QA_SITE_PUBLIC_KEY}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ body: text }),
    });
    return response.status;
  }

  async listMessages(): Promise<SiteMessage[]> {
    const response = await fetch(`${APP_URL}/api/astro-chat/${QA_SITE_PUBLIC_KEY}/messages`, { headers: this.headers() });
    const body = (await response.json().catch(() => ({ items: [] }))) as { items?: SiteMessage[] };
    return body.items ?? [];
  }

  /** Envia e espera a resposta do ASTRO (ou da equipe) que chegar depois. */
  async send(text: string): Promise<string> {
    const status = await this.post(text);
    if (status !== 200) throw new Error(`Envio recusado com HTTP ${status}.`);
    const before = this.lastSeenMessageId;
    const deadline = Date.now() + REPLY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      const messages = await this.listMessages();
      const lastVisitorIndex = messages.map((message) => message.author).lastIndexOf("visitor");
      const reply = messages.slice(lastVisitorIndex + 1).find((message) => message.author !== "visitor");
      if (reply && reply.id !== before) {
        this.lastSeenMessageId = reply.id;
        return reply.body;
      }
    }
    throw new Error(`O ASTRO não respondeu "${text}" em ${REPLY_TIMEOUT_MS / 1000}s.`);
  }

  /** Lead criado para este visitante (aparece na primeira mensagem). */
  async leadId(): Promise<string | null> {
    const visitor = await prisma.astroChatVisitor.findUnique({
      where: { tokenHash: hashVisitorToken(this.token) },
      select: { leadId: true },
    });
    return visitor?.leadId ?? null;
  }
}

/** Limpeza: visitantes do site de QA criados depois do início do caso. */
export async function removeSiteVisitorsSince(startedAt: Date): Promise<void> {
  await prisma.astroChatVisitor.deleteMany({
    where: { site: { publicKey: QA_SITE_PUBLIC_KEY }, createdAt: { gte: startedAt } },
  });
}
