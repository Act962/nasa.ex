import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";

// ─── Date/Time Helpers ────────────────────────────────────────────────────────

export function parseDate(cmd: string): Date {
  // Handle ISO string (e.g. "2026-03-31T10:50:36.434Z") — from partialContext re-use
  const isoMatch = cmd.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return d;
  }
  if (cmd.includes("/amanhã") || cmd.includes("/amanha") || cmd.includes("amanhã") || cmd.includes("amanha")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (cmd.includes("/semana_que_vem") || cmd.includes("semana que vem")) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (cmd.includes("hoje")) return new Date();
  // Try "DD de MMMM" / "DD de MMMM de YYYY" (e.g. "01 de abril", "15 de junho de 2026")
  const MONTHS: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const ptDateMatch = cmd.match(/(\d{1,2})\s+de\s+([a-záçêô]+)(?:\s+de\s+(\d{4}))?/i);
  if (ptDateMatch) {
    const day = parseInt(ptDateMatch[1]);
    const month = MONTHS[ptDateMatch[2].toLowerCase()];
    const year = ptDateMatch[3] ? parseInt(ptDateMatch[3]) : new Date().getFullYear();
    if (month) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // Try DD.MM.AAAA pattern
  const dateMatch = cmd.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dateMatch) return new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
  return new Date();
}

// Normalise a time string from any format to "HH:mm"
// Handles: "14h", "14h30", "14:00", "2 horas da tarde", "às 14h", "14 horas", "2pm", etc.
export function normalizeTimeStr(raw: string): string | null {
  const s = raw.toLowerCase().trim();
  // Already HH:mm
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0");
  // "Nh" or "Nh30" patterns
  const hMatch = s.match(/(\d{1,2})h(\d{2})?/);
  if (hMatch) return `${String(hMatch[1]).padStart(2, "0")}:${hMatch[2] ?? "00"}`;
  // "N horas" / "N hora" (natural language)
  const horasMatch = s.match(/(\d{1,2})\s*horas?/);
  if (horasMatch) {
    let h = parseInt(horasMatch[1]);
    if (s.includes("tarde") || s.includes("noite")) h = h < 12 ? h + 12 : h;
    return `${String(h).padStart(2, "0")}:00`;
  }
  // "N da tarde / noite / manhã"
  const periodMatch = s.match(/(\d{1,2})\s*(?:da\s+)?(tarde|noite|manhã|manha)/);
  if (periodMatch) {
    let h = parseInt(periodMatch[1]);
    const period = periodMatch[2];
    if ((period === "tarde" || period === "noite") && h < 12) h += 12;
    return `${String(h).padStart(2, "0")}:00`;
  }
  return null;
}

export function parseTime(cmd: string): string | null {
  return normalizeTimeStr(cmd);
}

export function buildDateTime(date: Date, timeStr: string): Date {
  // Normalise first in case timeStr is natural language
  const normalized = normalizeTimeStr(timeStr) ?? timeStr;
  const [hours, minutes] = normalized.split(":").map(Number);
  const d = new Date(date);
  d.setHours(isNaN(hours) ? 9 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
  return d;
}

// ─── parsedVars parser ────────────────────────────────────────────────────────
// Parses /"key"="value" or /'key'='value' patterns

export function parseParsedVars(command: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match /"key"="value" or /"key"='value' or /'key'="value" or /'key'='value'
  const regex = /\/"([^"]+)"[=:]'([^']*)'|\/"([^"]+)"[=:]"([^"]*)"|\/['']([^'']+)[''][=:]"([^"]*)"|\/"([^"]+)"[=:]([^\s,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(command)) !== null) {
    const key = m[1] ?? m[3] ?? m[5] ?? m[7];
    const val = m[2] ?? m[4] ?? m[6] ?? m[8];
    if (key && val !== undefined) {
      // LAST value wins — ISO dates from partialContext override human-readable ones
      result[key.toLowerCase()] = val;
    }
  }
  return result;
}

// ─── Star Costs ───────────────────────────────────────────────────────────────

export const STAR_COSTS = {
  query: 1,
  create: 3,
  ai_parse: 2,
  ai_generate: 8,
  move: 2,
};

// ─── Entity Resolution ────────────────────────────────────────────────────────

export async function resolveContact(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  return prisma.lead.findFirst({
    where: {
      name: { contains: normalized, mode: "insensitive" },
      tracking: { organizationId: orgId },
    },
    select: { id: true, name: true },
  });
}

export async function resolveUser(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  const member = await prisma.member.findFirst({
    where: {
      organizationId: orgId,
      user: { name: { contains: normalized, mode: "insensitive" } },
    },
    include: { user: { select: { id: true, name: true } } },
  });
  return member?.user ?? null;
}

export async function resolveProduct(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  return prisma.forgeProduct.findFirst({
    where: {
      organizationId: orgId,
      name: { contains: normalized, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
}

// ─── Title Extractor ──────────────────────────────────────────────────────────

export function extractTitle(command: string): string {
  const cleaned = command.replace(/#[\w-]+/g, "").replace(/\/[\w_ÀÀ-ÿ.]+/g, "").trim();
  return cleaned.slice(0, 60) || "Novo post";
}

export function extractTrackingName(command: string): string {
  const quotedMatch = command.match(/[\u201C"«]([^\u201D"»\n]+)[\u201D"»]/);
  if (quotedMatch) return quotedMatch[1].trim();
  const chamadoMatch = command.match(/chamado\s+(.+?)(?:\s+(?:no|com|em)\s+#|\s*$)/i);
  if (chamadoMatch) return chamadoMatch[1].trim();
  const addMatch = command.match(/\/Add_tracking\s+(.+?)(?:\s+(?:no|com)\s+#|\s*$)/i);
  if (addMatch) return addMatch[1].trim();
  return "Novo Tracking";
}

// ─── AI Provider Helper ───────────────────────────────────────────────────────

export async function getConnectedAIProvider(orgId: string) {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      organizationId: orgId,
      platform: { in: [IntegrationPlatform.ANTHROPIC, IntegrationPlatform.OPENAI, IntegrationPlatform.GEMINI] },
    },
  });
  return integrations;
}

export async function generateWithAI(
  orgId: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  const integrations = await getConnectedAIProvider(orgId);
  const integrationMap = new Map(integrations.map((i) => [i.platform, i]));

  // Anthropic first
  const anthropicInt = integrationMap.get(IntegrationPlatform.ANTHROPIC);
  if (anthropicInt) {
    const apiKey = (anthropicInt.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const anthropic = createAnthropic({ apiKey });
        const { text } = await generateText({
          model: anthropic("claude-3-haiku-20240307"),
          system: systemPrompt,
          prompt: userPrompt,
        });
        return text;
      } catch { /* continue */ }
    }
  }

  // OpenAI
  const openaiInt = integrationMap.get(IntegrationPlatform.OPENAI);
  if (openaiInt) {
    const apiKey = (openaiInt.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const openai = createOpenAI({ apiKey });
        const { text } = await generateText({
          model: openai("gpt-4o-mini"),
          system: systemPrompt,
          prompt: userPrompt,
        });
        return text;
      } catch { /* continue */ }
    }
  }

  // Gemini
  const geminiInt = integrationMap.get(IntegrationPlatform.GEMINI);
  if (geminiInt) {
    const apiKey = (geminiInt.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const google = createGoogleGenerativeAI({ apiKey });
        const { text } = await generateText({
          model: google("gemini-2.0-flash"),
          system: systemPrompt,
          prompt: userPrompt,
        });
        return text;
      } catch { /* continue */ }
    }
  }

  return null;
}

// ─── Type for execute output ──────────────────────────────────────────────────

export type ExecuteOutput = {
  type: "created" | "query_result" | "error" | "needs_input" | "post_generated" | "confirmation_needed";
  title: string;
  description: string;
  url?: string;
  appName: string;
  extraData?: unknown;
  /** Itens clicáveis exibidos abaixo da descrição (ex: lista de propostas, leads, etc.) */
  resultLinks?: Array<{ label: string; url: string }>;
  missingFields?: Array<{ key: string; label: string }>;
  partialContext?: Record<string, string>;
  content?: string;
  starsSpent?: number;
  confirmOptions?: Array<{ key: string; label: string; icon?: string }>;
};
