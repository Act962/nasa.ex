"use client";

import { useEffect, useState } from "react";
import { IdentifyForm } from "./identify-form";
import { InChatWindow } from "./in-chat-window";

/**
 * Container do In-Chat — decide se mostra form de identificação OU a
 * janela de chat baseado em ter sessão (cookie `nasa_inchat_lead`).
 *
 * Como o cookie é `httpOnly` (não acessível via JS), checamos a sessão
 * via fetch `/api/in-chat/[slug]/messages` — se 200 OK, está logado; se
 * 401, precisa identificar.
 *
 * O `IdentifyForm` por sua vez chama `/identify` que seta o cookie e
 * retorna `{ leadId, leadName }` — só então mudamos pra `<InChatWindow>`.
 */
export function InChatClient({
  slug,
  orgName,
  orgLogo,
}: {
  slug: string;
  orgName: string;
  orgLogo: string | null;
}) {
  const [identified, setIdentified] = useState<
    { leadId: string; leadName: string } | null | "loading"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/in-chat/${slug}/messages`, { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          // Já autenticado — não precisamos do nome ainda; deixamos o
          // InChatWindow buscar conforme renderiza.
          setIdentified({ leadId: "", leadName: "" });
        } else {
          setIdentified(null);
        }
      })
      .catch(() => {
        if (!cancelled) setIdentified(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (identified === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        Carregando...
      </div>
    );
  }

  if (!identified) {
    return (
      <IdentifyForm
        slug={slug}
        orgName={orgName}
        orgLogo={orgLogo}
        onIdentified={(payload) => setIdentified(payload)}
      />
    );
  }

  return (
    <InChatWindow slug={slug} orgName={orgName} orgLogo={orgLogo} />
  );
}
