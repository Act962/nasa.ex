import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { resend } from "./email/resend";
import { reactInvitationEmail } from "./email/invitation";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 6,
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
                where: { userId_organizationId: { userId: session.userId, organizationId: m.organizationId } },
                update: { lastSeenAt: new Date(), userName: m.user.name, userEmail: m.user.email, userImage: m.user.image },
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
  ],
});
