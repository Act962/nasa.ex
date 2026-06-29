"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form de identificação inicial — lead digita o telefone usado no
 * WhatsApp pra continuar a conversa via In-Chat. POST `/identify`
 * valida + seta cookie.
 *
 * Sprint 3.5 — In-Chat sempre acessível:
 *  - Phone existe na base → entra direto (1 step)
 *  - Phone NOVO → endpoint responde `needs_name`, form mostra campo Nome
 *    pro lead se apresentar; segundo submit cria lead via pipeline.
 *
 * Sem senha (lead não tem conta) — gate é phone único na base + cookie
 * httpOnly após match/criação.
 */
export function IdentifyForm({
  slug,
  orgName,
  orgLogo,
  onIdentified,
}: {
  slug: string;
  orgName: string;
  orgLogo: string | null;
  onIdentified: (data: { leadId: string; leadName: string }) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Quando true, lead é novo e a UI mostra campo de Nome. */
  const [needsName, setNeedsName] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/in-chat/${slug}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone,
          ...(needsName && name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const data = await res.json();

      // Lead novo precisa se apresentar primeiro
      if (data?.error === "needs_name") {
        setNeedsName(true);
        setError(null);
        return;
      }

      if (!res.ok || !data.success) {
        // Mensagens específicas por erro
        if (data?.error === "create_lead_failed") {
          setError(data.detail ?? "Falha ao criar conta. Tente de novo.");
        } else if (data?.error === "no_tracking_available") {
          setError("Empresa indisponível no momento.");
        } else {
          setError("Não foi possível continuar. Verifique o telefone.");
        }
        return;
      }
      onIdentified({ leadId: data.leadId, leadName: data.leadName });
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 space-y-5"
      >
        <div className="flex flex-col items-center gap-3">
          {orgLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogo}
              alt={orgName}
              className="size-16 rounded-full object-cover"
            />
          )}
          <h1 className="text-lg font-semibold text-center">
            {needsName
              ? "Como podemos te chamar?"
              : `Continue a conversa com ${orgName}`}
          </h1>
          <p className="text-xs text-zinc-500 text-center">
            {needsName
              ? "Não encontramos seu telefone na nossa base. Digite seu nome pra começar."
              : "Digite o telefone que você usa no WhatsApp pra ver suas mensagens — ou criar uma conversa nova."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+55 86 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={needsName /* trava phone após confirmar lead novo */}
            required
            autoFocus={!needsName}
          />
        </div>

        {needsName && (
          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Como você gostaria de ser chamado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Verificando..."
            : needsName
              ? "Começar conversa"
              : "Continuar"}
        </Button>

        {needsName && (
          <button
            type="button"
            onClick={() => {
              setNeedsName(false);
              setName("");
              setError(null);
            }}
            className="block w-full text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-center underline-offset-2 hover:underline"
          >
            Voltar e usar outro telefone
          </button>
        )}

        <p className="text-[10px] text-zinc-400 text-center">
          Esta página é segura — só você consegue ver suas mensagens.
        </p>
      </form>
    </div>
  );
}
