/**
 * Rate limit por binding — anti-spam + mitigação de detecção como bot.
 *
 * Limites configuráveis em `OrganizationBotConfig.maxCmdsPerHour` (default 30).
 * Quando o binding excede, bot responde mensagem amigável de espera e o
 * comando é logado com `status: "rate_limited"`.
 *
 * Janela: últimas 60 minutos. Conta cmds via `whatsapp_bot_command`
 * (`receivedAt >= now - 1h`).
 */
import "server-only";
import prisma from "@/lib/prisma";

export async function isWithinRateLimit(
  bindingId: string,
  maxCmdsPerHour: number,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.whatsappBotCommand.count({
    where: {
      bindingId,
      receivedAt: { gte: oneHourAgo },
      status: { not: "rate_limited" }, // tentativas bloqueadas não contam
    },
  });
  return {
    allowed: count < maxCmdsPerHour,
    count,
    limit: maxCmdsPerHour,
  };
}

export function isWithinQuietHours(
  quietStart: number | null | undefined,
  quietEnd: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (quietStart == null || quietEnd == null) return false;
  // Hora local América/São Paulo (horário comercial padrão do projeto)
  const hour = Number(
    now.toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }),
  );
  // Janela cross-meia-noite: ex. 22h → 8h
  if (quietStart > quietEnd) {
    return hour >= quietStart || hour < quietEnd;
  }
  // Janela normal: ex. 8h → 22h (quiet seria... 0h-8h ou 22h-24h, raro)
  return hour >= quietStart && hour < quietEnd;
}
