"use client";

import { Card } from "@/components/ui/card";
import { useOrgRole } from "@/hooks/use-org-role";
import { BindWhatsappDialog } from "./bind-whatsapp-dialog";
import { BindingsList } from "./bindings-list";
import { BotConfigSection } from "./bot-config-section";
import { AlertTriangle, Bot } from "lucide-react";

/**
 * Shell client-side da página "Insights pelo WhatsApp" (Astro).
 * Gestão (config + allow-list de números) é restrita a owner/admin.
 */
export function AstroBotSettings() {
  const { isMaster, isAdmin } = useOrgRole();
  const canConfigure = isMaster || isAdmin;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Bot className="size-6 text-violet-500 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-semibold">Insights pelo WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Peça insights dos seus dados (tracking, workspace e mais) ao Astro
              em linguagem natural, direto pelo número da tracking. Só números
              autorizados conversam com o Astro.
            </p>
          </div>
        </div>
      </Card>

      {!canConfigure ? (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
          <AlertTriangle className="size-4 text-yellow-600 shrink-0 mt-0.5" />
          <p>
            A configuração do Astro pelo WhatsApp é gerenciada por um Master ou
            Admin da organização. Fale com eles pra liberar seu número.
          </p>
        </div>
      ) : (
        <>
          <BotConfigSection />

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Adicionar número</h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre um número permitido e escolha em nome de qual membro
                  o Astro consulta os dados.
                </p>
              </div>
              <BindWhatsappDialog />
            </div>
          </Card>

          <BindingsList />
        </>
      )}
    </div>
  );
}
