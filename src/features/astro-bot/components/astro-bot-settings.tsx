"use client";

import { Card } from "@/components/ui/card";
import { useOrgRole } from "@/hooks/use-org-role";
import { BindWhatsappDialog } from "./bind-whatsapp-dialog";
import { BindingsList } from "./bindings-list";
import { BotConfigSection } from "./bot-config-section";
import { useBotConfig } from "@/features/astro-bot/hooks/use-astro-bot";
import { AlertTriangle, Bot } from "lucide-react";

/**
 * Shell client-side da página de Astro Bot WhatsApp.
 * - Owner/Admin: vê config + lista da org + pode vincular o próprio número.
 * - Member: vê só os próprios bindings + botão pra vincular (se org já ativada).
 */
export function AstroBotSettings() {
  const { isMaster, isAdmin } = useOrgRole();
  const canConfigure = isMaster || isAdmin;
  const { config, isLoading } = useBotConfig();

  const orgActive = !!config?.isActive;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Bot className="size-6 text-violet-500 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-semibold">Astro Bot via WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Converse com o Astro pelo seu WhatsApp pessoal — peça listagens,
              relatórios e ações simples sem precisar abrir a plataforma.
            </p>
          </div>
        </div>
      </Card>

      {canConfigure && <BotConfigSection />}

      {!canConfigure && !isLoading && !orgActive && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
          <AlertTriangle className="size-4 text-yellow-600 shrink-0 mt-0.5" />
          <p>
            O Astro Bot WhatsApp ainda não foi ativado para sua organização.
            Peça pra um Master ou Admin configurar o canal antes de vincular seu
            número.
          </p>
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Vincular meu WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre seu número pessoal pra falar com o Astro. Você define um
              PIN pra confirmar ações sensíveis.
            </p>
          </div>
          <BindWhatsappDialog />
        </div>
        {!orgActive && (
          <p className="text-xs text-muted-foreground">
            * O bot só vai responder quando a org tiver a configuração ativa.
          </p>
        )}
      </Card>

      <BindingsList />
    </div>
  );
}
