import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { stripe } from "@better-auth/stripe";
import { resend } from "./email/resend";
import { reactInvitationEmail } from "./email/invitation";
import { reactResetPasswordEmail } from "./email/reset-password";
import { stripeClient } from "./stripe";
import prisma from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [
    "http://localhost:3000",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    ...(process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
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
    },
  },
  databaseHooks: {
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
                console.error("[auth hook] auto-set activeOrganizationId failed:", e);
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
          // TODO: o model Plan não tem mais `stripePriceId` — o mapeamento
          // plan → Stripe price ID precisa vir de env ou de uma tabela
          // PaymentGatewayConfig dedicada. Por enquanto resolvemos via
          // env STRIPE_PRICE_<SLUG_UPPER>; planos sem price configurado
          // ficam fora do checkout do better-auth/stripe.
          const plans = await prisma.plan.findMany({
            where: { isActive: true },
          });
          return plans
            .map((p) => {
              const envKey = `STRIPE_PRICE_${p.slug.toUpperCase()}`;
              const priceId = process.env[envKey];
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
      },
    }),
  ],
});
