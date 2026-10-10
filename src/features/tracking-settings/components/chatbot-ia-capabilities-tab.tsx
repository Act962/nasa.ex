"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/spinner";
import { BOT_VOICES, DEFAULT_BOT_VOICE } from "@/features/astro-bot/lib/voice/voices";
import { Input } from "@/components/ui/input";
import {
  DISABLED_AI_CAPABILITIES,
  REMINDER_HOURS_OPTIONS,
  type AiCapabilities,
} from "@/features/tracking-chat-ai/lib/capabilities";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAiCapabilities, useUpdateAiCapabilities } from "../hooks/use-ai-capabilities";
import { KnowledgeChipPicker } from "@/features/astro-commander/components/intelligence/knowledge-chip-picker";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import Link from "next/link";

// Aba "O que o Astro pode fazer" do Chatbot IA (spec 0084). Tudo começa desligado.

function CapabilityRow({
  title,
  description,
  isEnabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  isEnabled: boolean;
  onToggle: (isEnabled: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 border-t py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={isEnabled} onCheckedChange={onToggle} />
      </div>
      {isEnabled && children}
    </div>
  );
}

interface NamedOption {
  id: string;
  name: string;
}

const MAX_COMPANY_LINKS = 5;

function CheckList({
  options,
  selectedIds,
  onToggle,
  emptyText,
}: {
  options: NamedOption[];
  selectedIds: string[];
  onToggle: (optionId: string) => void;
  emptyText: string;
}) {
  if (options.length === 0) {
    return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isSelected = selectedIds.includes(option.id);
        return (
          <label
            key={option.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm",
              isSelected && "border-primary",
            )}
          >
            <Checkbox checked={isSelected} onCheckedChange={() => onToggle(option.id)} />
            {option.name}
          </label>
        );
      })}
    </div>
  );
}

function toggleId(selectedIds: string[], optionId: string): string[] {
  return selectedIds.includes(optionId)
    ? selectedIds.filter((selectedId) => selectedId !== optionId)
    : [...selectedIds, optionId];
}

function CapabilitiesForm({
  trackingId,
  savedCapabilities,
  availableAgendas,
  availableForms,
  availableWorkspaces,
  availableKnowledge,
  canSave,
}: {
  trackingId: string;
  savedCapabilities: AiCapabilities;
  availableAgendas: NamedOption[];
  availableForms: NamedOption[];
  availableWorkspaces: NamedOption[];
  availableKnowledge: NamedOption[];
  canSave: boolean;
}) {
  const [capabilities, setCapabilities] = useState<AiCapabilities>(savedCapabilities);
  const updateCapabilities = useUpdateAiCapabilities();
  const selectedVoiceName = capabilities.voiceName ?? DEFAULT_BOT_VOICE;
  // Documento apagado depois de marcado some da contagem e do que é salvo.
  const selectedKnowledgeIds = capabilities.knowledgeIds.filter((knowledgeId) =>
    availableKnowledge.some((document) => document.id === knowledgeId),
  );

  const toggleAgenda = (agendaId: string) => {
    const agendaIds = toggleId(capabilities.agenda.agendaIds, agendaId);
    setCapabilities({ ...capabilities, agenda: { ...capabilities.agenda, agendaIds } });
  };

  const updateLink = (linkIndex: number, changes: Partial<{ label: string; url: string }>) => {
    const items = capabilities.links.items.map((link, index) => (index === linkIndex ? { ...link, ...changes } : link));
    setCapabilities({ ...capabilities, links: { ...capabilities.links, items } });
  };

  const handleSave = () => {
    // Linha de link em branco não é erro: só não é salva.
    const filledLinks = capabilities.links.items.filter((link) => link.label.trim() && link.url.trim());
    updateCapabilities.mutate(
      { trackingId, capabilities: { ...capabilities, links: { ...capabilities.links, items: filledLinks } } },
      {
        onSuccess: () => toast.success("Opções do Astro salvas"),
        onError: (error) => toast.error(error.message || "Erro ao salvar"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Cada opção ligada dá ao Astro só aquela capacidade, sempre presa ao cliente da conversa: ele
        nunca vê dados de outra pessoa nem da empresa. “Falar com atendente” funciona sempre.
      </p>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forma de atender</h3>
        <CapabilityRow
          title="Atender com menu de botões"
          description="O cliente marca, remarca, cancela e pede informações clicando. Só o que estiver ligado nesta tela aparece no menu. Dúvidas escritas, áudios e chamadas continuam com a assistente. Passos por clique não cobram resposta de IA."
          isEnabled={capabilities.guidedMenu}
          onToggle={(guidedMenu) => setCapabilities({ ...capabilities, guidedMenu })}
        />
      </section>

      <section data-guide={GUIDE_ANCHORS.chatbotIaKnowledgePicker.id}>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">O que o Astro sabe</h3>
        <div className="mt-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Documentos que o atendimento pode usar</p>
          <p className="mb-3 text-xs text-muted-foreground">
            O Astro responde ao cliente, por mensagem e por chamada, só com o que estiver nos documentos marcados.
          </p>
          <KnowledgeChipPicker
            options={availableKnowledge}
            selectedIds={selectedKnowledgeIds}
            onChange={(knowledgeIds) => setCapabilities({ ...capabilities, knowledgeIds })}
            emptyText="Nenhuma base cadastrada no ASTRO. Peça ao Astro “monte o atendimento com o site da minha empresa” ou escreva um documento na Auto Inteligência."
          />
          {selectedKnowledgeIds.length > 0 && (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/15 px-3 py-2 text-xs text-warning">
              O cliente pode ouvir ou ler o que estiver nos documentos marcados. Não marque material interno da equipe.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {availableKnowledge.length === 0
                ? ""
                : selectedKnowledgeIds.length === 0
                  ? "Nenhum marcado: o Astro responde só com as instruções da aba Geral."
                  : `${selectedKnowledgeIds.length} de ${availableKnowledge.length} marcados`}
            </span>
            <Link href="/astro?aba=auto-inteligencia" className="text-primary hover:underline">
              Gerenciar na Auto Inteligência →
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Áudio</h3>
        <CapabilityRow
          title="Entender áudio do cliente"
          description="Transcreve o áudio e responde ao que foi dito. O texto aparece no atendimento. Cobra Stars por minuto."
          isEnabled={capabilities.understandAudio}
          onToggle={(understandAudio) =>
            setCapabilities({
              ...capabilities,
              understandAudio,
              voiceReply: understandAudio ? capabilities.voiceReply : false,
            })
          }
        />
        <CapabilityRow
          title="Responder em áudio quando o cliente mandar áudio"
          description="Nota de voz seguida do texto. Horários, links e PIX continuam só em texto. 1 Star por minuto de áudio."
          isEnabled={capabilities.voiceReply}
          onToggle={(voiceReply) =>
            setCapabilities({
              ...capabilities,
              voiceReply,
              understandAudio: voiceReply ? true : capabilities.understandAudio,
            })
          }
        >
          <div className="flex flex-wrap gap-2">
            {BOT_VOICES.map((voice) => (
              <Button
                key={voice.name}
                type="button"
                size="sm"
                variant={selectedVoiceName === voice.name ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCapabilities({ ...capabilities, voiceName: voice.name })}
              >
                {voice.label}
              </Button>
            ))}
          </div>
        </CapabilityRow>
        <CapabilityRow
          title="Atender chamadas de voz"
          description="O cliente liga pelo WhatsApp e o Astro atende falando, com as mesmas opções ligadas nesta tela. A ligação fica transcrita na conversa. Só em número da API oficial com chamadas ativas; cobra Stars por minuto."
          isEnabled={capabilities.voiceCall}
          onToggle={(voiceCall) => setCapabilities({ ...capabilities, voiceCall })}
        />
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agenda</h3>
        <CapabilityRow
          title="Ver horários e agendar"
          description="O cliente marca, remarca e cancela só os agendamentos dele, sempre confirmando antes."
          isEnabled={capabilities.agenda.isEnabled}
          onToggle={(isEnabled) =>
            setCapabilities({ ...capabilities, agenda: { ...capabilities.agenda, isEnabled } })
          }
        >
          <CheckList
            options={availableAgendas}
            selectedIds={capabilities.agenda.agendaIds}
            onToggle={toggleAgenda}
            emptyText="Nenhuma agenda ativa. Crie uma agenda para o Astro oferecer."
          />
        </CapabilityRow>
        <CapabilityRow
          title="Lembrete antes do horário"
          description="Um lembrete por agendamento feito pelo Astro. “Parar” desliga para aquele cliente."
          isEnabled={capabilities.reminder.isEnabled}
          onToggle={(isEnabled) =>
            setCapabilities({ ...capabilities, reminder: { ...capabilities.reminder, isEnabled } })
          }
        >
          <div className="flex flex-wrap gap-2">
            {REMINDER_HOURS_OPTIONS.map((hoursBefore) => (
              <Button
                key={hoursBefore}
                type="button"
                size="sm"
                variant={capabilities.reminder.hoursBefore === hoursBefore ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCapabilities({ ...capabilities, reminder: { ...capabilities.reminder, hoursBefore } })}
              >
                {hoursBefore === 24 ? "1 dia antes" : hoursBefore === 48 ? "2 dias antes" : `${hoursBefore} horas antes`}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Input
              placeholder="Nome do template aprovado na Meta (opcional)"
              value={capabilities.reminder.templateName ?? ""}
              onChange={(event) =>
                setCapabilities({
                  ...capabilities,
                  reminder: { ...capabilities.reminder, templateName: event.target.value.trim() || null },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Na API oficial, o lembrete só sai fora das 24 horas com um template de utilidade em
              português, com duas variáveis no corpo: {"{{1}}"} nome do cliente e {"{{2}}"} o
              agendamento (ex.: “Consulta em 12/10 às 14:00”). Sem template, o lembrete só chega se o
              cliente tiver escrito nas últimas 24 horas.
            </p>
          </div>
        </CapabilityRow>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links e documentos</h3>
        <CapabilityRow
          title="Enviar formulário"
          description="O Astro envia o link dos formulários marcados, já ligado ao cliente."
          isEnabled={capabilities.forms.isEnabled}
          onToggle={(isEnabled) => setCapabilities({ ...capabilities, forms: { ...capabilities.forms, isEnabled } })}
        >
          <CheckList
            options={availableForms}
            selectedIds={capabilities.forms.formIds}
            onToggle={(formId) =>
              setCapabilities({
                ...capabilities,
                forms: { ...capabilities.forms, formIds: toggleId(capabilities.forms.formIds, formId) },
              })
            }
            emptyText="Nenhum formulário publicado."
          />
        </CapabilityRow>
        <CapabilityRow
          title="Enviar as fichas do cliente"
          description="Link só com as fichas dele (atendimentos, itens)."
          isEnabled={capabilities.myRecordsLink}
          onToggle={(myRecordsLink) => setCapabilities({ ...capabilities, myRecordsLink })}
        />
        <CapabilityRow
          title="Enviar links da empresa"
          description="Catálogo, site, cardápio. O Astro envia quando o assunto pedir."
          isEnabled={capabilities.links.isEnabled}
          onToggle={(isEnabled) => setCapabilities({ ...capabilities, links: { ...capabilities.links, isEnabled } })}
        >
          <div className="space-y-2">
            {capabilities.links.items.map((link, linkIndex) => (
              <div key={linkIndex} className="flex flex-wrap gap-2">
                <Input
                  className="w-40"
                  placeholder="Nome (ex.: Catálogo)"
                  value={link.label}
                  onChange={(event) => updateLink(linkIndex, { label: event.target.value })}
                />
                <Input
                  className="min-w-48 flex-1"
                  placeholder="https://…"
                  value={link.url}
                  onChange={(event) => updateLink(linkIndex, { url: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setCapabilities({
                      ...capabilities,
                      links: {
                        ...capabilities.links,
                        items: capabilities.links.items.filter((_, index) => index !== linkIndex),
                      },
                    })
                  }
                >
                  Remover
                </Button>
              </div>
            ))}
            {capabilities.links.items.length < MAX_COMPANY_LINKS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCapabilities({
                    ...capabilities,
                    links: { ...capabilities.links, items: [...capabilities.links.items, { label: "", url: "" }] },
                  })
                }
              >
                Adicionar link
              </Button>
            )}
          </div>
        </CapabilityRow>
        <CapabilityRow
          title="Receber documentos"
          description="O Astro confirma o recebimento de fotos e arquivos, que ficam na conversa e nos arquivos do cliente."
          isEnabled={capabilities.receiveDocuments}
          onToggle={(receiveDocuments) => setCapabilities({ ...capabilities, receiveDocuments })}
        />
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pagamento e equipe</h3>
        <CapabilityRow
          title="Enviar PIX da ficha"
          description="Copia e cola com o valor da ficha finalizada do cliente. A chave PIX é a cadastrada em Fichas."
          isEnabled={capabilities.recordPix}
          onToggle={(recordPix) => setCapabilities({ ...capabilities, recordPix })}
        />
        <CapabilityRow
          title="Registrar pedido para a equipe"
          description="O que o Astro não resolve vira demanda no Workspace escolhido, ligada ao cliente e no seu nome."
          isEnabled={capabilities.teamRequest.isEnabled}
          onToggle={(isEnabled) =>
            setCapabilities({ ...capabilities, teamRequest: { ...capabilities.teamRequest, isEnabled } })
          }
        >
          {availableWorkspaces.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Nenhum Workspace. Crie um para receber os pedidos.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableWorkspaces.map((workspace) => (
                <Button
                  key={workspace.id}
                  type="button"
                  size="sm"
                  variant={capabilities.teamRequest.workspaceId === workspace.id ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() =>
                    setCapabilities({
                      ...capabilities,
                      teamRequest: { ...capabilities.teamRequest, workspaceId: workspace.id },
                    })
                  }
                >
                  {workspace.name}
                </Button>
              ))}
            </div>
          )}
        </CapabilityRow>
      </section>

      {!canSave && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Preencha e salve a aba Geral do Fluxo de atendimento antes de ligar estas opções.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave || updateCapabilities.isPending}>
          {updateCapabilities.isPending ? <Spinner /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export function ChatBotIaCapabilitiesTab({ trackingId }: { trackingId: string }) {
  const { data, isLoading } = useAiCapabilities(trackingId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <CapabilitiesForm
      key={JSON.stringify(data?.capabilities ?? null)}
      trackingId={trackingId}
      savedCapabilities={data?.capabilities ?? DISABLED_AI_CAPABILITIES}
      availableAgendas={data?.availableAgendas ?? []}
      availableForms={data?.availableForms ?? []}
      availableWorkspaces={data?.availableWorkspaces ?? []}
      availableKnowledge={data?.availableKnowledge ?? []}
      canSave={data?.hasAiSettings ?? false}
    />
  );
}
