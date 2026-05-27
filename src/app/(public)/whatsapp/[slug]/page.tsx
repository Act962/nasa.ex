/**
 * In-Chat — página pública WhatsApp-clone.
 *
 * URL: `/whatsapp/[slug]?lead=<leadId>`
 *
 * **Sempre acessível** (Sprint 3.5) — não mais gated por inChatModeActive.
 * O lead acessa a qualquer momento confirmando seu telefone na tela de
 * identify. Funciona como 2º canal permanente alternativo ao WhatsApp.
 *
 * Fluxo:
 *  1. Server-side carrega org pelo `slug`. Se org não existe → 404
 *     (única razão de 404 — proteção contra slug inválido).
 *  2. Cliente lê cookie `nasa_inchat_lead`:
 *     - Sem cookie → renderiza form pedindo telefone (IdentifyForm).
 *       Se phone não existe na base, lead novo é criado via pipeline
 *       compartilhado (`processIncomingMessage source=in_chat_identify`)
 *       — Fase J — disparando IA/workflows/round-robin.
 *     - Com cookie → renderiza chat (InChatWindow).
 *
 * Identificação por telefone evita exigir senha (lead não tem conta).
 * Cookie httpOnly impede leak via XSS. Rate-limit no /identify protege
 * contra enumeração de telefones.
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

  // Página pública sempre disponível — só 404 quando slug não bate em
  // nenhuma org. Gate de identificação por telefone faz o resto.
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
    },
  });

  if (!org) {
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
