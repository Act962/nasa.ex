/**
 * In-Chat Fallback — página pública WhatsApp-clone.
 *
 * URL: `/whatsapp/[slug]?lead=<leadId>`
 *
 * Acessível pelo lead quando a instância de WhatsApp da org está banida
 * (modo `inChatModeActive`). Mostra UI idêntica ao WhatsApp Web —
 * histórico + composer — pra o lead continuar conversando sem WhatsApp.
 *
 * Fluxo:
 *  1. Server-side carrega org pelo `slug`.
 *  2. Se a org não existe ou nenhuma instância dela está em modo
 *     In-Chat ativo → 404 (não expõe o chat fora de emergência).
 *  3. Cliente lê cookie `nasa_inchat_lead`:
 *     - Sem cookie → renderiza form pedindo telefone (IdentifyForm).
 *     - Com cookie → renderiza chat (InChatWindow).
 *
 * Identificação por telefone evita exigir senha (lead não tem conta).
 * Cookie httpOnly impede leak via XSS.
 */

import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { InChatClient } from "./_components/in-chat-client";

export const dynamic = "force-dynamic";

export default async function InChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      // Verifica se PELO MENOS UMA instância da org está em modo In-Chat.
      // Não expomos o chat se WhatsApp normal está OK — anti-ban é
      // emergência, não fallback permanente.
      whatsappInstances: {
        where: { inChatModeActive: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!org || org.whatsappInstances.length === 0) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <InChatClient
        slug={slug}
        orgName={org.name}
        orgLogo={org.logo ?? null}
      />
    </main>
  );
}
