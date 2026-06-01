import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { stripe } from "@better-auth/stripe";
import type Stripe from "stripe";
import { resend } from "./email/resend";
import { reactInvitationEmail } from "./email/invitation";
import { reactResetPasswordEmail } from "./email/reset-password";
import { stripeClient } from "./stripe";
import prisma from "./prisma";
import { inngest } from "@/inngest/client";
import {
  applyPlanToOrgByName,
  runMonthlyCycle,
} from "@/features/stars/lib/star-service";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Força cookie-secure baseado SÓ em NODE_ENV. Sem isso, better-auth
  // marcava cookies como `__Secure-` + `Secure` quando `BETTER_AUTH_URL`
  // apontava pra HTTPS (produção), mesmo em dev rodando `http://localhost`.
  // Resultado: browser rejeitava silenciosamente o cookie → login API
  // retornava 200 mas a sessão não persistia. Em dev volta sempre a
  // cookie regular; em prod (NODE_ENV=production) continua secure.
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  trustedOrigins: [
    "http://localhost:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []),
  ],
  user: {
    additionalFields: {
      isSystemAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void resend.emails
        .send({
          from: "Nasaex <noreply@notifications.nasaex.com>",
          to: user.email,
          subject: "Redefina sua senha no NASA.ex",
          react: reactResetPasswordEmail({
            username: user.name,
            resetLink: url,
            appName: "NASA.ex",
            expirationMinutes: "60",
          }),
        })
        .catch((error) => {
          console.error("[auth] reset password email failed:", error);
        });
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Pede acesso ao Google Calendar já no login pra reuso opcional
      // (sincronização de agendamentos sem precisar conectar a integração).
      // scope: [
      //   "openid",
      //   "email",
      //   "profile",
      //   "https://www.googleapis.com/auth/calendar.events",
      // ],
      // accessType: "offline",
    },
  },
  databaseHooks: {
    // ── Sync de auth NASA → NERP (best-effort) ──────────────────
    // Só ENFILEIRA o evento; o processamento real (com retry/backoff) roda
    // numa função Inngest. try/catch que só loga: NUNCA quebra o sign-up se
    // o Inngest/NERP estiver fora.
    user: {
      create: {
        after: async (user) => {
          try {
            await inngest.send({
              name: "sync/user.upsert",
              data: { userId: user.id },
            });
          } catch (e) {
            console.error("[sync emit] user.create enqueue failed:", e);
          }
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          try {
            await inngest.send({
              name: "sync/account.upsert",
              data: { accountId: account.id },
            });
          } catch (e) {
            console.error("[sync emit] account.create enqueue failed:", e);
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          try {
            // Find all orgs this user belongs to
            const memberships = await prisma.member.findMany({
              where: { userId: session.userId },
              include: { user: true },
            });

            // Auto-select active organization on first login if not set yet.
            // Better-auth doesn't do this automatically — we pick the user's first
            // org so they land inside an org context instead of "Nenhuma empresa".
            if (!session.activeOrganizationId && memberships.length > 0) {
              try {
                await prisma.session.update({
                  where: { id: session.id },
                  data: { activeOrganizationId: memberships[0].organizationId },
                });
              } catch (e) {
                console.error(
                  "[auth hook] auto-set activeOrganizationId failed:",
                  e,
                );
              }
            }

            for (const m of memberships) {
              await prisma.systemActivityLog.create({
                data: {
                  organizationId: m.organizationId,
                  userId: session.userId,
                  userName: m.user.name,
                  userEmail: m.user.email,
                  userImage: m.user.image,
                  appSlug: "auth",
                  action: "auth.login",
                  actionLabel: "Realizou login na plataforma",
                  metadata: { sessionId: session.id },
                },
              });
              // Upsert presence
              await prisma.userPresence.upsert({
                where: {
                  userId_organizationId: {
                    userId: session.userId,
                    organizationId: m.organizationId,
                  },
                },
                update: {
                  lastSeenAt: new Date(),
                  userName: m.user.name,
                  userEmail: m.user.email,
                  userImage: m.user.image,
                },
                create: {
                  organizationId: m.organizationId,
                  userId: session.userId,
                  userName: m.user.name,
                  userEmail: m.user.email,
                  userImage: m.user.image,
                  lastSeenAt: new Date(),
                },
              });
            }
          } catch (e) {
            console.error("[auth hook] login log failed:", e);
          }
        },
      },
    },
  },
  plugins: [
    organization({
      // ── Sync de auth NASA → NERP (best-effort) ──────────────────
      // Só enfileira; replicação real com retry roda no Inngest.
      organizationHooks: {
        afterCreateOrganization: async ({ organization, member }) => {
          try {
            // Org primeiro, depois o Member do owner (a ordem do inbound já é
            // defensiva, mas enfileirar nessa ordem ajuda a convergir rápido).
            await inngest.send({
              name: "sync/org.upsert",
              data: { organizationId: organization.id },
            });
            if (member?.id) {
              await inngest.send({
                name: "sync/member.upsert",
                data: { memberId: member.id },
              });
            }
          } catch (e) {
            console.error("[sync emit] org.create enqueue failed:", e);
          }
        },
        afterAddMember: async ({ member }) => {
          try {
            await inngest.send({
              name: "sync/member.upsert",
              data: { memberId: member.id },
            });
          } catch (e) {
            console.error("[sync emit] member.add enqueue failed:", e);
          }
        },
        // better-auth NÃO dispara afterAddMember ao ACEITAR convite — só
        // afterAcceptInvitation (crud-invites cria o Member por fora). Sem este
        // hook, membros que entram por convite nunca replicavam pro NERP.
        afterAcceptInvitation: async ({ member }) => {
          try {
            await inngest.send({
              name: "sync/member.upsert",
              data: { memberId: member.id },
            });
          } catch (e) {
            console.error("[sync emit] member.accept enqueue failed:", e);
          }
        },
      },
      async sendInvitationEmail(data) {
        await resend.emails.send({
          from: "Nasaex <noreply@notifications.nasaex.com>",
          to: data.email,
          subject: "Você foi convidado(a) a participar de uma empresa.",
          react: reactInvitationEmail({
            username: data.email,
            invitedByUsername: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            teamName: data.organization.name,
            inviteLink:
              process.env.NODE_ENV === "development"
                ? `http://localhost:3000/accept-invitation/${data.id}`
                : `${
                    process.env.BETTER_AUTH_URL || "https://nasa-ex.vercel.app"
                  }/accept-invitation/${data.id}`,
          }),
        });
      },
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: async () => {
          // Mapeamento plan → Stripe price ID:
          //  1. Prioridade: `Plan.stripePriceId` (configurável em /admin/plans)
          //  2. Fallback: env var `STRIPE_PRICE_<SLUG_UPPER>` (retrocompat)
          // Planos sem nenhum dos dois ficam fora do checkout do better-auth/stripe.
          const plans = await prisma.plan.findMany({
            where: { isActive: true },
          });
          return plans
            .map((p) => {
              const priceId =
                p.stripePriceId ||
                process.env[`STRIPE_PRICE_${p.slug.toUpperCase()}`];
              if (!priceId) return null;
              return {
                name: p.name.toLowerCase(),
                priceId,
                limits: {
                  maxUsers: p.maxUsers,
                  monthlyStars: p.monthlyStars,
                  rolloverPct: p.rolloverPct,
                  benefits: p.benefits,
                },
              };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
        },
        getCheckoutSessionParams: async () => {
          return {
            params: {
              allow_promotion_codes: true,
            },
          };
        },
        // ── Escopo por ORGANIZAÇÃO ──────────────────────────────────────────
        // As assinaturas usam `referenceId = organizationId` (o front passa
        // isso no `subscription.upgrade`). Aqui autorizamos quem pode mexer:
        // qualquer membro lê; só owner/admin contrata/cancela/restaura.
        authorizeReference: async ({ user, referenceId, action }) => {
          const member = await prisma.member.findFirst({
            where: { organizationId: referenceId, userId: user.id },
            select: { role: true },
          });
          if (!member) return false;
          if (
            action === "upgrade-subscription" ||
            action === "cancel-subscription" ||
            action === "restore-subscription"
          ) {
            return member.role === "owner" || member.role === "admin";
          }
          return true;
        },
        // ── Crédito de Stars no ciclo ───────────────────────────────────────
        // `referenceId` é o organizationId. Ao concluir o checkout, aplicamos
        // o plano à org (`Organization.planId`) e creditamos as Stars do ciclo.
        // ESTE é o ponto que faltava: sem ele, contratar plano gravava só a
        // tabela `subscription` e as Stars nunca chegavam na empresa.
        onSubscriptionComplete: async ({ subscription }) => {
          const orgId = subscription.referenceId;
          if (!orgId) return;
          await applyPlanToOrgByName(orgId, subscription.plan);
        },
        // Troca de plano (upgrade/downgrade) fora do checkout inicial: mantém
        // `Organization.planId` em sincronia e credita o novo plano quando muda.
        onSubscriptionUpdate: async ({ subscription }) => {
          const orgId = subscription.referenceId;
          if (!orgId || subscription.status !== "active") return;
          const [org, plan] = await Promise.all([
            prisma.organization.findUnique({
              where: { id: orgId },
              select: { planId: true },
            }),
            prisma.plan.findFirst({
              where: { name: { equals: subscription.plan, mode: "insensitive" } },
              select: { id: true },
            }),
          ]);
          if (plan && org && org.planId !== plan.id) {
            await applyPlanToOrgByName(orgId, subscription.plan);
          }
        },
        // Assinatura removida (período encerrado / deletada no Stripe): volta a
        // org pro estado sem plano. O `cancel` agendado (cancelAtPeriodEnd) NÃO
        // revoga aqui — a org segue ativa até o período acabar.
        onSubscriptionDeleted: async ({ subscription }) => {
          const orgId = subscription.referenceId;
          if (!orgId) return;
          await prisma.organization.update({
            where: { id: orgId },
            data: { planId: null },
          });
        },
      },
      // ── Renovação mensal recorrente ───────────────────────────────────────
      // O Stripe emite `invoice.paid` com billing_reason="subscription_cycle"
      // a cada renovação. Recreditamos as Stars do plano (novo ciclo) na org
      // dona da assinatura. Sem isso, só o primeiro mês creditava.
      onEvent: async (event) => {
        if (event.type !== "invoice.paid") return;
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== "subscription_cycle") return;
        const subField = (invoice as { subscription?: string | { id: string } | null })
          .subscription;
        const stripeSubId =
          typeof subField === "string" ? subField : (subField?.id ?? null);
        if (!stripeSubId) return;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: stripeSubId },
          select: { referenceId: true },
        });
        if (sub?.referenceId) {
          await runMonthlyCycle(sub.referenceId);
        }
      },
    }),
  ],
});
