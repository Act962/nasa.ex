/**
 * Cron: stars-grace-period-monitor
 *
 * Roda diariamente às 09:00 UTC. Varre orgs em "grace period" de STARs
 * (saldo zerou) e:
 *
 *   - Se recarregou → zera `starsGraceStartedAt` e notifica reativação.
 *   - Dia 1, 3, 7, 12, 14 → escalada de notificações.
 *   - Dia 15+ → marca `starsSuspendedAt = now` (middleware
 *     `requireStarsMiddleware` passa a barrar todas as procedures de
 *     cobrança a partir daí).
 *
 * O cron NÃO inicia o grace — quem inicia é o hook pós-débito em
 * `star-service.ts/dispatchPostDebitAlerts`, que populates
 * `starsGraceStartedAt` quando o saldo zera pela primeira vez.
 *
 * Mesmo pattern do `partner-grace-period-monitor`: notificações via
 * `createOrgNotification` (org-wide broadcast) com severity escalada.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { createOrgNotification } from "@/features/admin/lib/notification-service";

const GRACE_DAYS = 15;

type GraceMilestone = {
  day: number;
  title: string;
  body: (daysLeft: number) => string;
  severity: "warning" | "critical";
};

const MILESTONES: GraceMilestone[] = [
  {
    day: 1,
    title: "Saldo de STARs zerou — 14 dias pra recarregar",
    body: (d) => `Você tem ${d} dias pra recarregar antes da suspensão. Chat AI já está em modo humano.`,
    severity: "warning",
  },
  {
    day: 3,
    title: "STARs zerados há 3 dias — recarregue logo",
    body: (d) => `Faltam ${d} dias pra suspensão total da conta. Integrações pagas estão indisponíveis.`,
    severity: "warning",
  },
  {
    day: 7,
    title: "Metade do prazo já passou — 8 dias restantes",
    body: (d) => `Em ${d} dias a conta será suspensa e nenhuma feature de cobrança funcionará.`,
    severity: "critical",
  },
  {
    day: 12,
    title: "Apenas 3 dias até a suspensão",
    body: (d) => `Restam ${d} dias. Após esse prazo a conta entra em suspensão total — recarregue agora.`,
    severity: "critical",
  },
  {
    day: 14,
    title: "Última chance: conta suspende amanhã",
    body: () => `Amanhã sua conta será suspensa. Recarregue as STARs nas próximas 24h pra evitar.`,
    severity: "critical",
  },
];

export const starsGracePeriodMonitor = inngest.createFunction(
  { id: "stars-grace-period-monitor", retries: 1 },
  { cron: "0 9 * * *" }, // diariamente 09h UTC
  async ({ step }) => {
    const now = new Date();

    // Pega orgs em grace ativa (não suspensas).
    const inGrace = await step.run("fetch-orgs-in-grace", () =>
      prisma.organization.findMany({
        where: {
          starsGraceStartedAt: { not: null },
          starsSuspendedAt: null,
        },
        select: {
          id: true,
          name: true,
          starsBalance: true,
          starsBonusBalance: true,
          starsGraceStartedAt: true,
        },
      }),
    );

    let reactivated = 0;
    let notified = 0;
    let suspended = 0;

    for (const org of inGrace) {
      if (!org.starsGraceStartedAt) continue;

      const totalStars = (org.starsBalance ?? 0) + (org.starsBonusBalance ?? 0);

      // Saldo voltou → zera grace e notifica reativação.
      if (totalStars > 0) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { starsGraceStartedAt: null, starsLastAlertAt: null },
        });
        await createOrgNotification({
          organizationId: org.id,
          type: "STARS_ALERT",
          title: "Conta reativada — STARs recarregadas",
          body: `O saldo foi recarregado e todas as integrações estão de volta. Bom trabalho!`,
          severity: "info",
        });
        reactivated++;
        continue;
      }

      // Calcula dias dentro do grace (a partir da meia-noite UTC do dia
      // que `starsGraceStartedAt` foi setado). Sempre arredondamos pra
      // baixo para que "dia 1" seja o primeiro alerta após zerar.
      const graceStart = new Date(org.starsGraceStartedAt as unknown as string);
      const daysInGrace = Math.floor(
        (now.getTime() - graceStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      const daysLeft = GRACE_DAYS - daysInGrace;

      // Suspensão total.
      if (daysInGrace >= GRACE_DAYS) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { starsSuspendedAt: now },
        });
        await createOrgNotification({
          organizationId: org.id,
          type: "STARS_ALERT",
          title: "Conta suspensa por falta de STARs",
          body: `Sua conta entrou em suspensão. Todas as procedures de cobrança foram bloqueadas. Recarregue pra reativar.`,
          severity: "critical",
          requiresAck: true,
        });
        suspended++;
        continue;
      }

      // Notif escalada pelos milestones.
      const milestone = MILESTONES.find((m) => m.day === daysInGrace);
      if (milestone) {
        await createOrgNotification({
          organizationId: org.id,
          type: "STARS_ALERT",
          title: milestone.title,
          body: milestone.body(daysLeft),
          severity: milestone.severity,
        });
        await prisma.organization.update({
          where: { id: org.id },
          data: { starsLastAlertAt: now },
        });
        notified++;
      }
    }

    return {
      scannedAt: now.toISOString(),
      totalInGrace: inGrace.length,
      reactivated,
      notified,
      suspended,
    };
  },
);
