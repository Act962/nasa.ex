"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Form de identificação inicial — lead digita o telefone usado no
 * WhatsApp pra continuar a conversa via In-Chat. POST `/identify`
 * valida + seta cookie. Sem senha (não temos cadastro do lead).
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/in-chat/${slug}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mensagem genérica — não vaza se phone existe ou não na org.
        setError("Número não encontrado. Verifique e tente de novo.");
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
            Continue a conversa com {orgName}
          </h1>
          <p className="text-xs text-zinc-500 text-center">
            Digite o telefone que você usa no WhatsApp pra ver suas
            mensagens.
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
            required
            autoFocus
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Verificando..." : "Continuar"}
        </Button>
        <p className="text-[10px] text-zinc-400 text-center">
          Esta página é segura — só você consegue ver suas mensagens.
        </p>
      </form>
    </div>
  );
}
