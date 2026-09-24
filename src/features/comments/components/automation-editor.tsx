"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCommentsAutomation,
  useSaveCommentsTrigger,
  useSetCommentsAutomationActive,
} from "../hooks/use-comments-automations";
import { useCommentsContent } from "../hooks/use-comments-channel";
import { AutomationCanvas, buildCanvasModel } from "./automation-canvas";
import { AutomationEditorHeader } from "./automation-editor-header";
import { AutomationPanel } from "./automation-panel";
import { validateButton } from "./message-button-editor";
import {
  EMPTY_EDITOR_STATE,
  type ContentType,
  type EditorState,
  type EventType,
  type PanelView,
} from "./editor-types";

/** Largura da coluna. Fica aqui porque a alça de recolher se alinha nela. */
const PANEL_WIDTH = 380;

export function AutomationEditor({ automationId }: { automationId: string }) {
  const { data: automation, isLoading } = useCommentsAutomation(automationId);
  const saveTrigger = useSaveCommentsTrigger();
  const setActive = useSetCommentsAutomationActive();

  const [state, setState] = useState<EditorState>(EMPTY_EDITOR_STATE);
  const [view, setView] = useState<PanelView>({ kind: "overview" });
  const [isPanelOpen, setPanelOpen] = useState(true);
  const [refitSignal, setRefitSignal] = useState(0);

  const isCommentTrigger = state.eventType === "COMMENT_CREATED";
  const content = useCommentsContent(
    isCommentTrigger && state.targetScope === "SPECIFIC_CONTENT",
  );

  useEffect(() => {
    if (!automation) return;
    const trigger = automation.triggers[0];
    if (!trigger) return;

    const includeRule = trigger.rules.find(
      (rule) => rule.kind === "INCLUDE" && rule.operator !== "ANY_TEXT",
    );
    const anyTextRule = trigger.rules.find(
      (rule) => rule.kind === "INCLUDE" && rule.operator === "ANY_TEXT",
    );
    const excludeRule = trigger.rules.find((rule) => rule.kind === "EXCLUDE");
    const dmStep = trigger.steps.find(
      (step) => step.kind === "SEND_DIRECT_MESSAGE",
    );
    const replyStep = trigger.steps.find(
      (step) => step.kind === "REPLY_TO_COMMENT",
    );

    const dmConfig = (dmStep?.config ?? {}) as {
      source?: "STATIC" | "AI";
      text?: string;
      aiPrompt?: string;
      buttons?: { title: string; url: string }[];
    };
    const replyConfig = (replyStep?.config ?? {}) as { variants?: string[] };
    const variants = replyConfig.variants ?? [];

    setState({
      triggerId: trigger.id,
      eventType: trigger.eventType as EventType,
      targetScope:
        trigger.targetScope === "SPECIFIC_CONTENT"
          ? "SPECIFIC_CONTENT"
          : "ALL_CONTENT",
      // Carregar descartando tipo e midia era o bug do "OTHER": no save
      // seguinte o vazio ia por cima do que o provider tinha devolvido.
      targets: trigger.targets.map((target) => ({
        externalContentId: target.externalContentId,
        contentType: (target.contentType ?? "OTHER") as ContentType,
        mediaUrl: target.mediaUrl,
        permalink: target.permalink,
        caption: target.caption,
      })),
      anyText: Boolean(anyTextRule),
      includeTerms: includeRule?.terms ?? [],
      excludeTerms: excludeRule?.terms ?? [],
      dmSource: dmConfig.source ?? "STATIC",
      dmText: dmConfig.text ?? "",
      aiPrompt: dmConfig.aiPrompt ?? "",
      buttons: dmConfig.buttons ?? [],
      publicReplyEnabled: variants.length > 0,
      publicReplies: variants,
    });
  }, [automation]);

  const canvasModel = useMemo(
    () =>
      buildCanvasModel({
        eventType: state.eventType,
        targetScope: state.targetScope,
        targetCount: state.targets.length,
        includeTerms: state.includeTerms,
        excludeTerms: state.excludeTerms,
        anyText: state.anyText,
        dmText: state.dmSource === "AI" ? state.aiPrompt : state.dmText,
        dmSource: state.dmSource,
        buttonCount: state.buttons.length,
        publicReplies: state.publicReplyEnabled ? state.publicReplies : [],
      }),
    [state],
  );

  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    setRefitSignal((current) => current + 1);
  };

  const handleSave = () => {
    // Antes isto era um `.filter()` silencioso: botão sem URL simplesmente
    // sumia no salvar, sem uma palavra. Agora recusa e diz qual e por quê.
    const invalidIndex = state.buttons.findIndex((button) =>
      validateButton(button),
    );
    if (invalidIndex >= 0) {
      toast.error(
        `Botão ${invalidIndex + 1}: ${validateButton(state.buttons[invalidIndex])}`,
      );
      setView({ kind: "response" });
      return;
    }

    const rules: {
      kind: "INCLUDE" | "EXCLUDE";
      operator: "ANY_TEXT" | "CONTAINS";
      terms: string[];
    }[] = [];

    if (state.anyText || state.includeTerms.length === 0) {
      rules.push({ kind: "INCLUDE", operator: "ANY_TEXT", terms: [] });
    } else {
      rules.push({
        kind: "INCLUDE",
        operator: "CONTAINS",
        terms: state.includeTerms,
      });
    }
    if (state.excludeTerms.length > 0) {
      rules.push({
        kind: "EXCLUDE",
        operator: "CONTAINS",
        terms: state.excludeTerms,
      });
    }

    const steps: {
      kind: "SEND_DIRECT_MESSAGE" | "REPLY_TO_COMMENT";
      order: number;
      config: Record<string, unknown>;
    }[] = [
      {
        kind: "SEND_DIRECT_MESSAGE",
        order: 0,
        config: {
          source: state.dmSource,
          text: state.dmText,
          aiPrompt: state.aiPrompt,
          buttons: state.buttons.map((button) => ({ type: "URL", ...button })),
        },
      },
    ];

    const replies = state.publicReplyEnabled
      ? state.publicReplies.filter((reply) => reply.trim())
      : [];
    if (isCommentTrigger && replies.length > 0) {
      steps.push({
        kind: "REPLY_TO_COMMENT",
        order: 1,
        config: { variants: replies, strategy: "RANDOM" },
      });
    }

    // Alvo salvo antes desta correcao ficou sem midia; se a listagem fresca
    // ja esta em maos, reidrata na gravacao em vez de exigir reescolher.
    const freshById = new Map(
      (content.data?.items ?? []).map((item) => [item.externalId, item]),
    );
    const enrichedTargets = state.targets.map((target) => {
      const fresh = freshById.get(target.externalContentId);
      if (!fresh) return target;
      return {
        ...target,
        contentType: fresh.contentType as ContentType,
        mediaUrl: fresh.mediaUrl ?? target.mediaUrl,
        permalink: fresh.permalink ?? target.permalink,
        caption: fresh.caption ?? target.caption,
      };
    });

    saveTrigger.mutate(
      {
        automationId,
        triggerId: state.triggerId,
        eventType: state.eventType,
        targetScope: isCommentTrigger ? state.targetScope : "ALL_CONTENT",
        matchLogic: "ANY_RULE",
        targets:
          isCommentTrigger && state.targetScope === "SPECIFIC_CONTENT"
            ? enrichedTargets
            : [],
        rules,
        steps,
      },
      {
        onSuccess: () => toast.success("Automação salva"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (isLoading || !automation) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando automação...
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AutomationEditorHeader
        automationId={automationId}
        name={automation.name}
        isActive={automation.isActive}
        onSave={handleSave}
        isSaving={saveTrigger.isPending}
        isTogglingActive={setActive.isPending}
        onToggleActive={(isActive) =>
          setActive.mutate(
            { id: automationId, isActive },
            {
              onSuccess: () =>
                toast.success(
                  isActive ? "Automação ativada" : "Automação desativada",
                ),
              onError: (error) => toast.error(error.message),
            },
          )
        }
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {/*
        Coluna de configuração: é parte do layout, não overlay. Recolher devolve
        a largura ao canvas em vez de só descobrir o que estava escondido.
      */}
      <aside
        className={cn(
          "shrink-0 overflow-hidden border-r bg-background transition-[width] duration-300 ease-in-out",
          isPanelOpen ? "w-[380px]" : "w-0",
        )}
      >
        <div
          className="flex h-full flex-col"
          style={{ width: PANEL_WIDTH }}
          // `inert` em vez de `aria-hidden`: com a coluna recolhida os campos
          // continuam no DOM, e sem isto o Tab levaria o foco para dentro de
          // algo invisível.
          inert={!isPanelOpen}
        >
          <AutomationPanel
            automationName={automation.name}
            isActive={automation.isActive}
            issues={automation.issues}
            view={view}
            setView={setView}
            state={state}
            setState={setState}
            content={{
              items: content.data?.items ?? [],
              isLoading: content.isLoading,
              needsReconnect: Boolean(content.data?.needsReconnect),
            }}
            onSave={handleSave}
            isSaving={saveTrigger.isPending}
            isTogglingActive={setActive.isPending}
            onToggleActive={() =>
              setActive.mutate(
                { id: automationId, isActive: !automation.isActive },
                {
                  onSuccess: () =>
                    toast.success(
                      automation.isActive
                        ? "Automação desativada"
                        : "Automação ativada",
                    ),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          />
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <AutomationCanvas
          model={canvasModel}
          refitSignal={refitSignal}
          onNodeSelect={(section) => {
            // Clicar no nó abre a tela daquele nó — gatilho leva ao resumo do
            // gatilho, resposta leva ao editor da mensagem.
            setView(
              section === "response"
                ? { kind: "response" }
                : { kind: "triggerSummary" },
            );
            if (!isPanelOpen) togglePanel(true);
          }}
        />

      </div>

      {/* Alça na emenda das duas colunas — abre e recolhe a configuração. */}
      <button
        type="button"
        onClick={() => togglePanel(!isPanelOpen)}
        aria-label={isPanelOpen ? "Recolher configuração" : "Abrir configuração"}
        className={cn(
          "absolute top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-all duration-300 ease-in-out hover:bg-muted",
          isPanelOpen ? "left-[380px] -translate-x-1/2" : "left-3",
        )}
      >
        {isPanelOpen ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        </button>
      </div>
    </div>
  );
}
