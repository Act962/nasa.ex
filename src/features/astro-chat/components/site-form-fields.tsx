"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingRow } from "@/features/astro-commander/components/setting-row";
import { useAstroChatSetupOptions } from "../hooks/use-astro-chat-sites";
import { ASTRO_CHAT_TOPICS } from "../lib/data-topics";
import { OriginsInput } from "./origins-input";
import { WidgetAvatarUploader } from "./widget-avatar-uploader";
import type { SiteFormValues } from "./site-form-values";

/** Campos do site, em seções. `sections` escolhe quais aparecem em cada aba. */

export type SiteFormSection = "basics" | "appearance" | "intelligence" | "permissions";

type FieldsProps = {
  values: SiteFormValues;
  onChange: (patch: Partial<SiteFormValues>) => void;
  sections: SiteFormSection[];
};

const FIRST_STATUS_VALUE = "__first__";

export function SiteFormFields({ values, onChange, sections }: FieldsProps) {
  const { trackings, knowledgeBases } = useAstroChatSetupOptions();
  const selectedTracking = trackings.find((tracking) => tracking.id === values.trackingId);

  return (
    <div>
      {sections.includes("basics") && (
        <>
          <SettingRow label="Nome do site" description="Só para você identificar no Órbita.">
            <Input value={values.name} maxLength={80} onChange={(event) => onChange({ name: event.target.value })} />
          </SettingRow>
          <SettingRow
            label="Domínios permitidos"
            description="O widget só abre nesses endereços. Cadastre com https:// — o www é liberado junto."
          >
            <OriginsInput value={values.allowedOrigins} onChange={(allowedOrigins) => onChange({ allowedOrigins })} />
          </SettingRow>
          <SettingRow label="Tracking de destino" description="Onde cada visitante vira lead.">
            <Select
              value={values.trackingId || undefined}
              onValueChange={(trackingId) => onChange({ trackingId, statusId: null })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha um tracking" />
              </SelectTrigger>
              <SelectContent>
                {trackings.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Etapa de entrada" description="Padrão: a primeira etapa do funil.">
            <Select
              value={values.statusId ?? FIRST_STATUS_VALUE}
              onValueChange={(statusId) => onChange({ statusId: statusId === FIRST_STATUS_VALUE ? null : statusId })}
              disabled={!selectedTracking}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FIRST_STATUS_VALUE}>Primeira etapa</SelectItem>
                {selectedTracking?.status.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}

      {sections.includes("appearance") && (
        <>
          <SettingRow label="Nome do assistente" description="Como o ASTRO se apresenta no site.">
            <Input
              value={values.assistantName}
              maxLength={40}
              onChange={(event) => onChange({ assistantName: event.target.value })}
            />
          </SettingRow>
          <SettingRow label="Saudação" description="Aparece no balão sobre o ASTRO e abre a conversa.">
            <Textarea
              value={values.greeting}
              maxLength={200}
              rows={2}
              onChange={(event) => onChange({ greeting: event.target.value })}
            />
          </SettingRow>
          <SettingRow label="Ícone" description="A imagem que o visitante vê no canto do site. Sem ela, o rosto do ASTRO.">
            <WidgetAvatarUploader
              value={values.avatarUrl}
              accentColor={values.accentColor}
              onChange={(avatarUrl) => onChange({ avatarUrl })}
            />
          </SettingRow>
          <SettingRow label="Cor" description="Cabeçalho, botões e balões do visitante.">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={values.accentColor}
                onChange={(event) => onChange({ accentColor: event.target.value })}
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent"
                aria-label="Cor do widget"
              />
              <span className="font-mono text-sm text-muted-foreground">{values.accentColor}</span>
            </div>
          </SettingRow>
          <SettingRow label="Tema do painel" description="Combine com o site do cliente.">
            <Select
              value={values.widgetTheme}
              onValueChange={(widgetTheme) =>
                onChange({ widgetTheme: widgetTheme as SiteFormValues["widgetTheme"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Posição" description="Canto da tela onde o ASTRO flutua.">
            <Select value={values.position} onValueChange={(position) => onChange({ position: position as SiteFormValues["position"] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Canto inferior direito</SelectItem>
                <SelectItem value="left">Canto inferior esquerdo</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Política de Privacidade" description="Link exibido no rodapé do chat (LGPD).">
            <Input
              value={values.privacyUrl}
              placeholder="https://www.suaempresa.com.br/privacidade"
              onChange={(event) => onChange({ privacyUrl: event.target.value })}
            />
          </SettingRow>
        </>
      )}

      {sections.includes("intelligence") && (
        <>
          <SettingRow
            label="ASTRO responde"
            description="Desligado, o widget vira só um canal: as mensagens chegam no Chat para a equipe responder."
          >
            <Switch checked={values.aiEnabled} onCheckedChange={(aiEnabled) => onChange({ aiEnabled })} />
          </SettingRow>
          <SettingRow
            label="Instruções"
            description="O que o ASTRO deve saber e como atender: produtos, horários, tom, o que oferecer."
          >
            <Textarea
              value={values.instructions}
              rows={6}
              maxLength={6000}
              placeholder="Ex.: Somos uma clínica odontológica em Teresina. Atendemos de seg a sex, 8h às 18h. Ofereça avaliação gratuita…"
              onChange={(event) => onChange({ instructions: event.target.value })}
            />
          </SettingRow>
          <SettingRow
            label="Bases de conhecimento"
            description="Só as marcadas aqui ficam disponíveis para o público. Nada interno da empresa é usado."
          >
            {knowledgeBases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma base cadastrada no ASTRO.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {knowledgeBases.map((knowledgeBase) => {
                  const isSelected = values.knowledgeIds.includes(knowledgeBase.id);
                  return (
                    <button
                      key={knowledgeBase.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          knowledgeIds: isSelected
                            ? values.knowledgeIds.filter((id) => id !== knowledgeBase.id)
                            : [...values.knowledgeIds, knowledgeBase.id],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {knowledgeBase.name}
                    </button>
                  );
                })}
              </div>
            )}
          </SettingRow>
          <SettingRow
            label="Teto diário de respostas"
            description="Trava contra abuso: acima disso a equipe assume até o dia seguinte."
          >
            <Input
              type="number"
              min={10}
              max={5000}
              value={values.dailyAiReplyLimit}
              onChange={(event) => onChange({ dailyAiReplyLimit: Number(event.target.value) || 10 })}
            />
          </SettingRow>
        </>
      )}

      {sections.includes("permissions") && (
        <>
          <SettingRow
            label="O que o visitante pode pedir"
            description="Desligue o que o ASTRO não deve responder no site. Ele recusa com educação e oferece chamar a equipe."
          >
            <div className="space-y-3">
              {ASTRO_CHAT_TOPICS.map((topic) => {
                const blocked = values.blockedTopicIds ?? [];
                const isBlocked = blocked.includes(topic.id);
                return (
                  <div key={topic.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{topic.label}</p>
                      <p className="text-xs text-muted-foreground">{topic.description}</p>
                    </div>
                    <Switch
                      checked={!isBlocked}
                      aria-label={topic.label}
                      onCheckedChange={(isAllowed) =>
                        onChange({
                          blockedTopicIds: isAllowed
                            ? blocked.filter((id) => id !== topic.id)
                            : [...blocked, topic.id],
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </SettingRow>
          <SettingRow
            label="Outras restrições"
            description="Regras da casa, escritas como você diria à equipe."
          >
            <Textarea
              value={values.restrictionNotes}
              rows={4}
              maxLength={2000}
              placeholder="Ex.: nunca comparar com concorrente; não prometer prazo abaixo de 15 dias; não falar de processos judiciais."
              onChange={(event) => onChange({ restrictionNotes: event.target.value })}
            />
          </SettingRow>
        </>
      )}
    </div>
  );
}
