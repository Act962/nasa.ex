"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ChevronLeft,
  Instagram,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Link as LinkIcon,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MAX_BUTTON_TEMPLATE_CHARS,
  MAX_MESSAGE_CHARS,
  countChars,
} from "@/modules/social/domain/message-chunker";
import type { ContentRef, EditorState, PanelView } from "./editor-types";
import {
  MessageButtonEditor,
  validateButton,
  type MessageButtonValue,
} from "./message-button-editor";
import {
  ContentThumb,
  OptionCard,
  PanelSectionTitle,
  TermInput,
  TextListInput,
} from "./panel-parts";

type WizardStep = "type" | "where" | "match" | "publicReply";

const STEP_TITLES: Record<WizardStep, string> = {
  type: "O que inicia esta automação?",
  where: "Qual publicação você quer usar na automação?",
  match: "O que vai acionar a automação?",
  publicReply: "Quer responder publicamente no comentário?",
};

/**
 * Os passos são derivados do gatilho: comentário tem três decisões depois do
 * tipo, direct tem uma só. Mostrar as três sempre foi o que fez a barra
 * lateral parecer um painel de controle.
 */
export function wizardStepsFor(eventType: EditorState["eventType"]): WizardStep[] {
  return eventType === "COMMENT_CREATED"
    ? ["type", "where", "match", "publicReply"]
    : ["type", "match"];
}

type PanelProps = {
  automationName: string;
  isActive: boolean;
  issues: { message: string }[];
  view: PanelView;
  setView: (view: PanelView) => void;
  state: EditorState;
  setState: Dispatch<SetStateAction<EditorState>>;
  content: {
    items: ContentRef[];
    isLoading: boolean;
    needsReconnect: boolean;
  };
  onSave: () => void;
  isSaving: boolean;
  onToggleActive: () => void;
  isTogglingActive: boolean;
};

export function AutomationPanel(props: PanelProps) {
  const { view, state } = props;
  const steps = wizardStepsFor(state.eventType);

  if (view.kind === "trigger") {
    return <TriggerWizard {...props} steps={steps} stepIndex={view.stepIndex} />;
  }
  if (view.kind === "triggerSummary") {
    return <TriggerSummary {...props} />;
  }
  if (view.kind === "response") {
    return <ResponseView {...props} />;
  }
  return <OverviewView {...props} />;
}

function PanelHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-3">
      {onBack && (
        <Button variant="ghost" size="icon" className="size-7" onClick={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function triggerSummaryLines(state: EditorState): string[] {
  const lines: string[] = [];

  if (state.eventType === "COMMENT_CREATED") {
    lines.push(
      state.targetScope === "ALL_CONTENT"
        ? "Em todas as publicações"
        : `${state.targets.length} publicação(ões)`,
    );
  } else {
    lines.push("Mensagem no direct");
  }

  lines.push(
    state.anyText || state.includeTerms.length === 0
      ? "Qualquer texto"
      : `Contém: ${state.includeTerms.join(", ")}`,
  );

  if (state.excludeTerms.length > 0) {
    lines.push(`Não contém: ${state.excludeTerms.join(", ")}`);
  }

  return lines;
}

function OverviewView({
  automationName,
  isActive,
  issues,
  setView,
  state,
}: PanelProps) {
  const replies = state.publicReplies.filter((reply) => reply.trim());

  return (
    <>
      <PanelHeader
        title={automationName}
        subtitle={isActive ? "Ativa" : "Pausada"}
      />

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Quando...</h3>
          <button
            type="button"
            onClick={() => setView({ kind: "triggerSummary" })}
            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5">
                <Zap className="size-3.5 text-primary" />
              </span>
              <span className="text-sm font-medium">
                {state.eventType === "COMMENT_CREATED"
                  ? "Alguém comenta"
                  : "Alguém manda direct"}
              </span>
            </div>
            <div className="mt-2 space-y-0.5 pl-9">
              {triggerSummaryLines(state).map((line) => (
                <p key={line} className="truncate text-xs text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Então...</h3>

          <button
            type="button"
            onClick={() => setView({ kind: "response" })}
            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5">
                {state.dmSource === "AI" ? (
                  <Sparkles className="size-3.5 text-primary" />
                ) : (
                  <Send className="size-3.5 text-primary" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Instagram</p>
                <p className="truncate text-sm font-medium">
                  {state.dmSource === "AI" ? "Resposta por IA" : "Enviar mensagem"}
                </p>
              </div>
            </div>
            <p className="mt-2 truncate pl-9 text-xs text-muted-foreground">
              {(state.dmSource === "AI" ? state.aiPrompt : state.dmText).trim() ||
                "Clique para escrever"}
            </p>
          </button>

          {state.eventType === "COMMENT_CREATED" && replies.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setView({
                  kind: "trigger",
                  stepIndex: wizardStepsFor(state.eventType).indexOf(
                    "publicReply",
                  ),
                })
              }
              className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 p-1.5">
                  <MessageCircle className="size-3.5 text-primary" />
                </span>
                <span className="text-sm font-medium">
                  Responder no comentário
                </span>
              </div>
              <p className="mt-2 truncate pl-9 text-xs text-muted-foreground">
                {replies.length} variação(ões)
              </p>
            </button>
          )}
        </section>

        {issues.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="mb-1 font-medium">Falta para poder ativar:</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {issues.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </>
  );
}

function TriggerSummary({
  state,
  setView,
  automationName,
  content,
}: PanelProps) {
  // Alvo gravado antes da correcao nao tem midia; se a listagem fresca ja
  // chegou, usa ela so para exibir.
  const freshById = new Map(content.items.map((item) => [item.externalId, item]));
  const steps = wizardStepsFor(state.eventType);
  const replies = state.publicReplies.filter((reply) => reply.trim());

  return (
    <>
      <PanelHeader
        title={
          state.eventType === "COMMENT_CREATED"
            ? "Comentário na publicação"
            : "Mensagem no direct"
        }
        subtitle={automationName}
        onBack={() => setView({ kind: "overview" })}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {state.eventType === "COMMENT_CREATED" && (
          <section className="space-y-2">
            <PanelSectionTitle index={1}>
              Quando alguém comenta
            </PanelSectionTitle>
            <div className="rounded-lg border p-3 text-sm">
              {state.targetScope === "ALL_CONTENT" ? (
                "Todas as publicações"
              ) : state.targets.length === 0 ? (
                <span className="text-destructive">
                  Nenhuma publicação escolhida
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {state.targets.slice(0, 6).map((target) => {
                    const fresh = freshById.get(target.externalContentId);
                    return (
                      <ContentThumb
                        key={target.externalContentId}
                        className="size-12"
                        contentType={fresh?.contentType ?? target.contentType}
                        mediaUrl={target.mediaUrl ?? fresh?.mediaUrl}
                        caption={target.caption ?? fresh?.caption}
                      />
                    );
                  })}
                  {state.targets.length > 6 && (
                    <span className="flex size-12 items-center justify-center rounded-md border text-xs">
                      +{state.targets.length - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <PanelSectionTitle index={state.eventType === "COMMENT_CREATED" ? 2 : 1}>
            {state.eventType === "COMMENT_CREATED"
              ? "E o comentário"
              : "E a mensagem"}
          </PanelSectionTitle>
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <p>
              {state.anyText || state.includeTerms.length === 0
                ? state.eventType === "COMMENT_CREATED"
                  ? "Qualquer comentário"
                  : "Qualquer mensagem"
                : `Contém: ${state.includeTerms.join(", ")}`}
            </p>
            {state.excludeTerms.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Não contém: {state.excludeTerms.join(", ")}
              </p>
            )}
          </div>
        </section>

        {state.eventType === "COMMENT_CREATED" && (
          <section className="space-y-2">
            <PanelSectionTitle index={3}>
              Responder também ao comentário
            </PanelSectionTitle>
            <div className="rounded-lg border p-3 text-sm">
              {replies.length === 0 ? (
                <span className="text-muted-foreground">Não</span>
              ) : (
                <div className="space-y-1.5">
                  {replies.map((reply, index) => (
                    <p key={index} className="truncate text-xs">
                      {reply}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="border-t p-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setView({ kind: "trigger", stepIndex: 0 })}
        >
          <Pencil className="size-4" />
          Editar {steps.length > 1 ? "gatilho" : "regras"}
        </Button>
      </div>
    </>
  );
}

function TriggerWizard({
  state,
  setState,
  setView,
  content,
  steps,
  stepIndex,
  onSave,
  isSaving,
}: PanelProps & { steps: WizardStep[]; stepIndex: number }) {
  const step = steps[stepIndex] ?? steps[0];
  const isLast = stepIndex >= steps.length - 1;
  const isMultiStep = steps.length > 1;

  const goBack = () => {
    if (stepIndex === 0) {
      setView({ kind: "overview" });
      return;
    }
    setView({ kind: "trigger", stepIndex: stepIndex - 1 });
  };

  const goNext = () => {
    if (isLast) {
      onSave();
      setView({ kind: "triggerSummary" });
      return;
    }
    setView({ kind: "trigger", stepIndex: stepIndex + 1 });
  };

  return (
    <>
      <PanelHeader
        title={
          state.eventType === "COMMENT_CREATED"
            ? "Comentário na publicação"
            : "Mensagem no direct"
        }
        onBack={goBack}
      />

      {isMultiStep && (
        <div className="space-y-1.5 border-b px-3 py-3">
          <p className="text-xs text-muted-foreground">
            Etapa {stepIndex + 1} de {steps.length}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <h3 className="text-base font-semibold leading-snug">
          {STEP_TITLES[step]}
        </h3>

        {step === "type" && (
          <div className="space-y-2">
            <OptionCard
              title="Comentário na publicação ou reel"
              description="O usuário comenta e recebe sua resposta no direct."
              selected={state.eventType === "COMMENT_CREATED"}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  eventType: "COMMENT_CREATED",
                }))
              }
            />
            <OptionCard
              title="Mensagem no direct"
              description="O usuário manda uma DM e a automação responde."
              selected={state.eventType === "DIRECT_MESSAGE_RECEIVED"}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  eventType: "DIRECT_MESSAGE_RECEIVED",
                }))
              }
            />
          </div>
        )}

        {step === "where" && (
          <div className="space-y-2">
            <OptionCard
              title="Todas as publicações"
              description="Vale para o que já existe e para o que for publicado depois."
              selected={state.targetScope === "ALL_CONTENT"}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  targetScope: "ALL_CONTENT",
                }))
              }
            />
            <OptionCard
              title="Publicações específicas"
              description="Escolha em quais posts ou reels a automação vale."
              selected={state.targetScope === "SPECIFIC_CONTENT"}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  targetScope: "SPECIFIC_CONTENT",
                }))
              }
            >
              {content.isLoading && (
                <p className="text-xs text-muted-foreground">
                  Carregando publicações...
                </p>
              )}
              {content.needsReconnect && (
                <p className="text-xs text-destructive">
                  Reconecte a conta para listar as publicações.
                </p>
              )}
              {!content.isLoading &&
                !content.needsReconnect &&
                content.items.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma publicação encontrada nesta conta.
                  </p>
                )}

              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                {content.items.map((item) => {
                  const selected = state.targets.some(
                    (target) => target.externalContentId === item.externalId,
                  );
                  return (
                    <button
                      key={item.externalId}
                      type="button"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          targets: selected
                            ? current.targets.filter(
                                (target) =>
                                  target.externalContentId !== item.externalId,
                              )
                            : [
                                ...current.targets,
                                {
                                  externalContentId: item.externalId,
                                  contentType: item.contentType,
                                  mediaUrl: item.mediaUrl,
                                  permalink: item.permalink,
                                  caption: item.caption,
                                },
                              ],
                        }))
                      }
                      className={cn(
                        "aspect-square overflow-hidden rounded-md border",
                        selected
                          ? "ring-2 ring-primary"
                          : "opacity-80 hover:opacity-100",
                      )}
                    >
                      <ContentThumb
                        className="size-full rounded-none border-0"
                        contentType={item.contentType}
                        mediaUrl={item.mediaUrl}
                        caption={item.caption}
                        showLabel
                      />
                    </button>
                  );
                })}
              </div>
            </OptionCard>
          </div>
        )}

        {step === "match" && (
          <div className="space-y-2">
            <OptionCard
              title="Palavras-chave específicas"
              selected={!state.anyText}
              onSelect={() =>
                setState((current) => ({ ...current, anyText: false }))
              }
            >
              <TermInput
                label={
                  state.eventType === "COMMENT_CREATED"
                    ? "O comentário contém:"
                    : "A mensagem contém:"
                }
                terms={state.includeTerms}
                onChange={(includeTerms) =>
                  setState((current) => ({ ...current, includeTerms }))
                }
              />
              <TermInput
                label={
                  state.eventType === "COMMENT_CREATED"
                    ? "O comentário NÃO contém:"
                    : "A mensagem NÃO contém:"
                }
                hint="Exclusão vence: se a palavra aparecer, a automação não dispara."
                terms={state.excludeTerms}
                onChange={(excludeTerms) =>
                  setState((current) => ({ ...current, excludeTerms }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Não diferencia maiúscula nem acento — &quot;Promoção&quot; e
                &quot;promocao&quot; são a mesma coisa.
              </p>
            </OptionCard>

            <OptionCard
              title={
                state.eventType === "COMMENT_CREATED"
                  ? "Qualquer comentário"
                  : "Qualquer mensagem"
              }
              selected={state.anyText}
              onSelect={() =>
                setState((current) => ({ ...current, anyText: true }))
              }
            />
          </div>
        )}

        {step === "publicReply" && (
          <div className="space-y-2">
            <OptionCard
              title="Sim, respostas aleatórias"
              description="Uma variação é sorteada a cada disparo, para não repetir sempre a mesma frase."
              selected={state.publicReplyEnabled}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  publicReplyEnabled: true,
                  publicReplies:
                    current.publicReplies.length > 0
                      ? current.publicReplies
                      : [""],
                }))
              }
            >
              <TextListInput
                values={state.publicReplies}
                placeholder="Ex: Enviei no seu direct 🚀"
                addLabel="Nova resposta"
                onChange={(publicReplies) =>
                  setState((current) => ({ ...current, publicReplies }))
                }
              />
            </OptionCard>

            <OptionCard
              title="Não"
              description="Responde só no direct, sem comentar publicamente."
              selected={!state.publicReplyEnabled}
              onSelect={() =>
                setState((current) => ({
                  ...current,
                  publicReplyEnabled: false,
                }))
              }
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t p-3">
        <Button variant="outline" size="icon" onClick={goBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button className="flex-1" onClick={goNext} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLast ? (
            <Save className="size-4" />
          ) : null}
          {isLast ? "Salvar" : "Continuar"}
        </Button>
      </div>
    </>
  );
}

function ResponseView({
  state,
  setState,
  setView,
  onSave,
  isSaving,
}: PanelProps) {
  const isAi = state.dmSource === "AI";
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // O limite cai quando a mensagem vira template de botao.
  const limit =
    state.buttons.length > 0 ? MAX_BUTTON_TEMPLATE_CHARS : MAX_MESSAGE_CHARS;
  const used = countChars(isAi ? state.aiPrompt : state.dmText);
  const isOverLimit = !isAi && used > limit;

  const updateButtons = (buttons: MessageButtonValue[]) =>
    setState((current) => ({ ...current, buttons }));

  return (
    <>
      <PanelHeader
        title="Enviar mensagem"
        subtitle="Instagram · resposta privada"
        onBack={() => setView({ kind: "overview" })}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label className="flex items-center gap-1.5 text-xs">
            <Sparkles className="size-3.5" />
            Gerar resposta com IA
          </Label>
          <Switch
            checked={isAi}
            onCheckedChange={(checked) =>
              setState((current) => ({
                ...current,
                dmSource: checked ? "AI" : "STATIC",
              }))
            }
          />
        </div>

        {isAi ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Instruções para a IA</Label>
            <Textarea
              rows={6}
              value={state.aiPrompt}
              placeholder="Ex: responda com o preço do curso e convide para o link da bio"
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  aiPrompt: event.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Cada resposta gerada consome Stars.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mensagem</Label>
              <span
                className={cn(
                  "text-[11px]",
                  isOverLimit ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {used}/{limit}
              </span>
            </div>
            <Textarea
              rows={6}
              value={state.dmText}
              placeholder="Oi! Segue o link que você pediu"
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  dmText: event.target.value,
                }))
              }
            />
            {state.buttons.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Com botão a Meta reduz o texto de {MAX_MESSAGE_CHARS} para{" "}
                {MAX_BUTTON_TEMPLATE_CHARS} caracteres.
              </p>
            )}
            {isOverLimit && (
              <p className="text-xs text-destructive">
                O texto passa do limite e seria cortado no envio.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Botões (máx. 3)</Label>

          {state.buttons.map((button, index) => {
            const error = validateButton(button);
            return (
              <MessageButtonEditor
                key={index}
                open={editingIndex === index}
                value={button}
                onOpenChange={(open) => {
                  if (open) {
                    setEditingIndex(index);
                    return;
                  }
                  // Fechar clicando fora descarta botao que nunca chegou a ser
                  // preenchido, em vez de deixar linha invalida na lista.
                  if (validateButton(state.buttons[index])) {
                    updateButtons(
                      state.buttons.filter((_, position) => position !== index),
                    );
                  }
                  setEditingIndex(null);
                }}
                onConfirm={(value) => {
                  updateButtons(
                    state.buttons.map((item, position) =>
                      position === index ? value : item,
                    ),
                  );
                  setEditingIndex(null);
                }}
                onDelete={() => {
                  updateButtons(
                    state.buttons.filter((_, position) => position !== index),
                  );
                  setEditingIndex(null);
                }}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50",
                    error && "border-destructive/60",
                    editingIndex === index && "border-primary bg-primary/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {button.title.trim() || "Botão sem título"}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        error ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {error ?? button.url}
                    </span>
                  </span>
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </MessageButtonEditor>
            );
          })}

          {state.buttons.length < 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => {
                updateButtons([...state.buttons, { title: "", url: "" }]);
                setEditingIndex(state.buttons.length);
              }}
            >
              <Plus className="size-4" />
              Adicionar botão
            </Button>
          )}
        </div>


        {!(isAi ? state.aiPrompt : state.dmText).trim() && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <Instagram className="size-3.5" />
            Escreva a mensagem para poder ativar a automação.
          </p>
        )}
      </div>

      <div className="border-t p-3">
        <Button className="w-full" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar
        </Button>
      </div>
    </>
  );
}
