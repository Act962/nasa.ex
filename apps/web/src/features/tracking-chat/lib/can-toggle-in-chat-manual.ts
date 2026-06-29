import prisma from "@/lib/prisma";

/**
 * Decide se um usuário pode ativar/desativar o modo manual do In-Chat
 * para uma instância WhatsApp da org.
 *
 * Regra (espelha o padrão do canEditInsightsLayout):
 *  - role === "owner"     → sempre (Master da empresa)
 *  - role === "moderador" → sempre
 *  - role === "admin"     → sempre (admins têm autoridade pra mudar
 *                          configuração operacional do chat)
 *  - role === "member"    → nunca
 *  - role === "viewer"    → nunca
 *
 * Reutilizável tanto no client (hook `useCanToggleInChatManual`) quanto
 * no server (procedure `toggle-in-chat-manual`) — defense in depth.
 */
export async function canToggleInChatManual(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId: orgId },
    select: { role: true },
  });

  if (!member) return false;
  return (
    member.role === "owner" ||
    member.role === "admin" ||
    member.role === "moderador"
  );
}
