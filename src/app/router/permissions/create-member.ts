import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "crypto";

// Generate a secure temporary password (12 chars: letters + digits)
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(12))
    .map((b) => chars[b % chars.length])
    .join("");
}

export const createMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      email: z.string().email({ message: "E-mail inválido" }),
      name: z.string().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }),
      role: z.enum(["owner", "admin", "member", "moderador"]).default("member"),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    // Only Master (owner) or Moderador can add members
    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || !["owner", "moderador"].includes(currentMember.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para adicionar membros" });
    }

    // Only Master can add another Master
    if (input.role === "owner" && currentMember.role !== "owner") {
      throw new ORPCError("FORBIDDEN", { message: "Apenas o Master pode adicionar outro Master" });
    }

    const emailLower = input.email.toLowerCase().trim();

    // Check if this email is already a member of this org
    const existingMember = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        user: { email: emailLower },
      },
    });
    if (existingMember) {
      throw new ORPCError("BAD_REQUEST", { message: "Este e-mail já é membro desta organização" });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    let userId: string;
    let isNewUser = false;

    // Check if user already exists in the system
    const existingUser = await prisma.user.findFirst({
      where: { email: emailLower },
    });

    if (existingUser) {
      // User exists globally — just add to this org
      userId = existingUser.id;
    } else {
      // Create new user account
      isNewUser = true;
      const { createId } = await import("@paralleldrive/cuid2");
      const newUserId = createId();

      await prisma.user.create({
        data: {
          id: newUserId,
          name: input.name,
          email: emailLower,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create credential account (Better Auth pattern)
      await prisma.account.create({
        data: {
          id: createId(),
          accountId: newUserId,
          providerId: "credential",
          userId: newUserId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      userId = newUserId;
    }

    // Add as member to this organization
    const { createId: cid } = await import("@paralleldrive/cuid2");
    const newMember = await prisma.member.create({
      data: {
        id: cid(),
        organizationId: orgId,
        userId,
        role: input.role,
        createdAt: new Date(),
      },
      include: { user: true },
    });

    // Log activity
    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "member_added",
        resource: emailLower,
        resourceId: userId,
        metadata: { role: input.role, isNewUser },
      },
    });

    // Send welcome email with credentials
    try {
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to: emailLower,
        subject: `Você foi adicionado(a) a ${context.org.name} no Nasaex`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
            <h2 style="color:#fff;margin-bottom:8px;">Bem-vindo(a) ao Nasaex 🚀</h2>
            <p style="color:#a3a3a3;margin-bottom:24px;">
              <strong style="color:#e5e5e5">${context.user.name}</strong> adicionou você à empresa
              <strong style="color:#e5e5e5">${context.org.name}</strong>.
            </p>
            <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 12px;font-size:13px;color:#a3a3a3;">Suas credenciais de acesso:</p>
              <p style="margin:0 0 8px;font-size:14px;"><span style="color:#71717a">E-mail:</span> <strong style="color:#fff">${emailLower}</strong></p>
              <p style="margin:0;font-size:14px;"><span style="color:#71717a">Senha temporária:</span> <strong style="color:#a78bfa;font-size:16px;letter-spacing:2px;">${isNewUser ? tempPassword : "(use a senha já cadastrada)"}</strong></p>
            </div>
            ${isNewUser ? `
            <p style="font-size:13px;color:#ef4444;font-weight:600;margin-bottom:16px;">
              ⚠️ Altere sua senha após o primeiro acesso por razões de segurança.
            </p>
            ` : ""}
            <a href="${process.env.BETTER_AUTH_URL || "https://nasa-ex.vercel.app"}/sign-in"
               style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              Acessar plataforma
            </a>
            <p style="margin-top:24px;font-size:11px;color:#52525b;">
              Nasaex · Este e-mail foi enviado automaticamente, não responda.
            </p>
          </div>
        `,
      });
    } catch {
      // Email failure is non-blocking — member was already created
    }

    return {
      member: newMember,
      tempPassword: isNewUser ? tempPassword : null,
      isNewUser,
    };
  });
