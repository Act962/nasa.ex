"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingRow } from "@/features/astro-commander/components/setting-row";
import {
  useDeleteAstroChatSite,
  useReactivateAstroChatSite,
  useRotateAstroChatKey,
  useUpdateAstroChatSite,
} from "../hooks/use-astro-chat-sites";
import { describeSiteStatus } from "../utils/site-status";
import { InstallSnippet } from "./install-snippet";
import { SiteFormFields, type SiteFormSection } from "./site-form-fields";
import { toSitePayload, type SiteFormValues } from "./site-form-values";
import { SiteStatusPill } from "./site-status-pill";
import type { AstroChatSiteRow } from "./types";

/** Página de um site do ASTRO CHAT: instalação, configurações e cobrança. */

const SETTINGS_TABS: { value: string; label: string; sections: SiteFormSection[] }[] = [
  { value: "destino", label: "Site e destino", sections: ["basics"] },
  { value: "aparencia", label: "Aparência", sections: ["appearance"] },
  { value: "inteligencia", label: "Inteligência", sections: ["intelligence"] },
  { value: "permissoes", label: "Permissões", sections: ["permissions"] },
];

function toFormValues(site: AstroChatSiteRow): SiteFormValues {
  return {
    name: site.name,
    allowedOrigins: site.allowedOrigins,
    trackingId: site.trackingId ?? "",
    statusId: site.statusId,
    aiEnabled: site.aiEnabled,
    assistantName: site.assistantName,
    greeting: site.greeting,
    instructions: site.instructions ?? "",
    knowledgeIds: site.knowledgeIds,
    accentColor: site.accentColor,
    avatarUrl: site.avatarUrl ?? null,
    widgetTheme: site.widgetTheme === "dark" ? "dark" : "light",
    blockedTopicIds: site.blockedTopicIds ?? [],
    restrictionNotes: site.restrictionNotes ?? "",
    position: site.position === "left" ? "left" : "right",
    privacyUrl: site.privacyUrl ?? "",
    dailyAiReplyLimit: site.dailyAiReplyLimit,
  };
}

function formatDate(value: Date | string | null): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

export function SiteDetail({
  site,
  monthlyPrice,
  onBack,
}: {
  site: AstroChatSiteRow;
  monthlyPrice: number;
  onBack: () => void;
}) {
  const [values, setValues] = useState<SiteFormValues>(() => toFormValues(site));
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const updateSite = useUpdateAstroChatSite();
  const deleteSite = useDeleteAstroChatSite();
  const rotateKey = useRotateAstroChatKey();
  const reactivateSite = useReactivateAstroChatSite();
  const status = describeSiteStatus(site);

  useEffect(() => {
    setValues(toFormValues(site));
  }, [site]);

  const saveSettings = () => {
    updateSite.mutate(
      { siteId: site.id, ...toSitePayload(values) },
      {
        onSuccess: () => toast.success("Configurações salvas"),
        onError: (error) => toast.error(error.message || "Não foi possível salvar."),
      },
    );
  };

  const today = new Date().toISOString().slice(0, 10);
  const repliesToday =
    site.aiRepliesDay && new Date(site.aiRepliesDay).toISOString().slice(0, 10) === today ? site.aiRepliesCount : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Sites
        </Button>
        <h2 className="text-xl font-semibold">{site.name}</h2>
        <SiteStatusPill label={status.label} tone={status.tone} />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Ligado</span>
          <Switch
            checked={site.isEnabled}
            onCheckedChange={(isEnabled) =>
              updateSite.mutate(
                { siteId: site.id, isEnabled },
                { onSuccess: () => toast.success(isEnabled ? "Widget ligado" : "Widget desligado") },
              )
            }
          />
        </div>
      </div>

      <Tabs defaultValue="instalacao" className="gap-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1.5 md:w-fit">
          <TabsTrigger value="instalacao" className="rounded-xl px-4 py-2">Instalação</TabsTrigger>
          {SETTINGS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl px-4 py-2">
              {tab.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="cobranca" className="rounded-xl px-4 py-2">Cobrança</TabsTrigger>
        </TabsList>

        <TabsContent value="instalacao" className="max-w-3xl space-y-6">
          <InstallSnippet publicKey={site.publicKey} />
          <SettingRow
            label="Trocar a chave"
            description="Use se o código foi parar num site que não é seu. O código antigo para de funcionar na hora."
          >
            <Button
              variant="outline"
              onClick={() =>
                rotateKey.mutate(
                  { siteId: site.id },
                  { onSuccess: () => toast.success("Chave trocada. Atualize o código no site.") },
                )
              }
              disabled={rotateKey.isPending}
            >
              <KeyRound className="size-4" /> Gerar nova chave
            </Button>
          </SettingRow>
        </TabsContent>

        {SETTINGS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="max-w-4xl">
            <SiteFormFields
              values={values}
              onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
              sections={tab.sections}
            />
            <div className="flex justify-end pt-4">
              <Button onClick={saveSettings} disabled={updateSite.isPending}>
                {updateSite.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="cobranca" className="max-w-4xl">
          <SettingRow label="Mensalidade" description="Débito automático em Stars por site ativo.">
            <p className="font-semibold">{monthlyPrice} Stars / mês</p>
          </SettingRow>
          <SettingRow label="Última cobrança">
            <p>{formatDate(site.lastBilledAt)}</p>
          </SettingRow>
          <SettingRow label="Próxima cobrança">
            <p>{formatDate(site.nextBillingAt)}</p>
          </SettingRow>
          <SettingRow
            label="Respostas do ASTRO hoje"
            description="Cada resposta de IA consome Stars à parte (2 por resposta)."
          >
            <p>
              {repliesToday} de {site.dailyAiReplyLimit}
            </p>
          </SettingRow>
          <SettingRow label="Visitantes" description="Navegadores que abriram o chat.">
            <p>{site._count.visitors}</p>
          </SettingRow>
          {site.pausedReason === "no_stars" && (
            <SettingRow label="Site pausado" description="Faltou saldo para a mensalidade. Recarregue Stars e reative.">
              <Button
                onClick={() =>
                  reactivateSite.mutate(
                    { siteId: site.id },
                    {
                      onSuccess: () => toast.success("Site reativado"),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
                disabled={reactivateSite.isPending}
              >
                Cobrar e reativar
              </Button>
            </SettingRow>
          )}
          <SettingRow label="Excluir site" description="Remove o widget. As conversas e os leads continuam no Chat.">
            <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          </SettingRow>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        isDangerous
        isLoading={deleteSite.isPending}
        title="Excluir este site?"
        description="O widget some do site na hora. Conversas e leads continuam no Chat."
        confirmText="Excluir"
        onConfirm={() =>
          deleteSite.mutate(
            { siteId: site.id },
            {
              onSuccess: () => {
                toast.success("Site excluído");
                onBack();
              },
            },
          )
        }
      />
    </div>
  );
}
