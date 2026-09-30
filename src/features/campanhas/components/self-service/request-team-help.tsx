"use client";

import { useState } from "react";
import { LifeBuoy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRequestTeamHelp } from "../../hooks/use-team-help";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") ?? "";

/** "Pedir ajuda à equipe" (spec 0040, RF-9): chamado com o contexto do passo + WhatsApp. */
export function RequestTeamHelp({
  step,
  errorMessage,
  size = "sm",
  contextLabel = "Disparo em Massa",
  appId = "campanhas",
}: {
  step: string;
  errorMessage?: string | null;
  size?: "sm" | "default";
  /** App de origem do chamado — o guia do Instagram reaproveita este botão. */
  contextLabel?: string;
  appId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState("");
  const createTicket = useRequestTeamHelp();

  const context = `[${contextLabel}] Passo: ${step}${errorMessage ? ` · Erro: ${errorMessage}` : ""}`;
  const whatsappUrl = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Olá! Preciso de ajuda. ${context}`)}`
    : null;

  function submitTicket() {
    createTicket.mutate(
      { appId, improvement: `${context}\n\n${details.trim() || "Preciso de ajuda neste passo."}` },
      {
        onSuccess: () => {
          toast.success("Chamado aberto. A equipe vai te responder em breve.");
          setIsOpen(false);
          setDetails("");
        },
        onError: () => toast.error("Não foi possível abrir o chamado agora."),
      },
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size={size} className="text-muted-foreground">
          <LifeBuoy className="size-4" /> Pedir ajuda à equipe
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">A gente te ajuda</p>
          <p className="text-xs text-muted-foreground">O chamado já vai com o passo em que você está.</p>
        </div>
        <Textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Conte rapidamente o que aconteceu (opcional)"
          rows={3}
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={submitTicket} disabled={createTicket.isPending}>
            Abrir chamado
          </Button>
          {whatsappUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
