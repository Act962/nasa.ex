import prisma from "@/lib/prisma";

/**
 * Garante que o usuário atual é owner/admin da org antes de configurar o Astro
 * Bot ou gerenciar a allow-list de números. Antes a checagem de role era TODO e
 * confiava só no front; agora é enforçada server-side.
 */
export async function assertOrgAdmin(params: {
  organizationId: string;
  userId: string;
  errors: { FORBIDDEN: (opts: { message: string }) => Error };
}): Promise<void> {
  const member = await prisma.member.findFirst({
    where: { organizationId: params.organizationId, userId: params.userId },
    select: { role: true },
  });
  const role = member?.role?.toLowerCase();
  if (role !== "owner" && role !== "admin") {
    throw params.errors.FORBIDDEN({
      message: "Apenas owner/admin pode gerenciar o Astro pelo WhatsApp.",
    });
  }
}
