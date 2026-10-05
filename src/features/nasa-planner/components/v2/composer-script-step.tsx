"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { usePlannerPillars } from "../../hooks/use-planner-planning";
import { ClientSelect } from "./client-select";
import { ComposerAstroPanel, type GeneratedPostDraft } from "./composer-astro-panel";
import { POST_TYPE_META, POST_TYPES } from "./planner-v2-utils";
import type { PlannerClient } from "./planner-v2-types";

/** Passo 1 do criador (spec 0058, RF-10): cliente, conta, formato e roteiro. */

export interface ScriptStepValues {
  organizationId: string;
  type: NasaPlannerPostType;
  title: string;
  script: string;
  objective: string;
  cta: string;
  pillarId: string | null;
  targetNetworks: Array<"INSTAGRAM" | "FACEBOOK">;
  targetIgAccountId: string | null;
  targetFbPageId: string | null;
  /** Criação (spec 0063, RF-4): formatos escolhidos — o primeiro é `type`, cada um vira um rascunho. */
  formats: NasaPlannerPostType[];
  /** Roteiros gerados pelo Astro, por formato. */
  generatedByFormat: Partial<Record<NasaPlannerPostType, GeneratedPostDraft>>;
}

function OptionPill({ isSelected, onSelect, children, disabled }: { isSelected: boolean; onSelect: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition disabled:opacity-40",
        isSelected ? "bg-foreground font-semibold text-background" : "bg-panel text-foreground hover:bg-knob/60",
      )}
    >
      {children}
    </button>
  );
}

export function ComposerScriptStep({
  clients,
  initialValues,
  isClientLocked,
  isCreating,
  isSaving,
  submitLabel,
  onSubmit,
}: {
  clients: PlannerClient[];
  initialValues: ScriptStepValues;
  isClientLocked: boolean;
  isCreating: boolean;
  isSaving: boolean;
  submitLabel: string;
  onSubmit: (values: ScriptStepValues) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const client = clients.find((candidate) => candidate.id === values.organizationId);
  const { pillars } = usePlannerPillars(values.organizationId ? [values.organizationId] : undefined);
  const igAccounts = client?.accounts.filter((account) => account.kind === "IG_BUSINESS") ?? [];
  const fbPages = client?.accounts.filter((account) => account.kind === "FB_PAGE") ?? [];
  const update = (patch: Partial<ScriptStepValues>) => setValues((current) => ({ ...current, ...patch }));
  const toggleFormat = (type: NasaPlannerPostType) => {
    if (!isCreating) {
      update({ type, formats: [type] });
      return;
    }
    const formats = values.formats.includes(type) ? values.formats.filter((format) => format !== type) : [...values.formats, type];
    if (formats.length === 0) return;
    update({ formats, type: formats[0] });
  };
  const applyGenerated = (generatedByFormat: Partial<Record<NasaPlannerPostType, GeneratedPostDraft>>) => {
    const primaryDraft = generatedByFormat[values.formats[0]];
    update({ generatedByFormat, ...(primaryDraft && { title: primaryDraft.title, script: primaryDraft.script }) });
  };
  const draftCount = isCreating ? values.formats.length : 1;

  const toggleNetwork = (network: "INSTAGRAM" | "FACEBOOK") =>
    update({
      targetNetworks: values.targetNetworks.includes(network)
        ? values.targetNetworks.filter((current) => current !== network)
        : [...values.targetNetworks, network],
    });

  return (
    <div className="flex flex-col gap-5 p-5">
      <section data-guide={GUIDE_ANCHORS.plannerComposerClient.id}>
        <p className="mb-2 text-xs text-muted-foreground">Cliente</p>
        <ClientSelect
          clients={clients}
          options={clients.filter((candidate) => candidate.permissions.canCreate)}
          selectedOrganizationId={values.organizationId}
          disabled={isClientLocked}
          onSelect={(organizationId) => {
            if (organizationId === values.organizationId) return;
            update({ organizationId, targetIgAccountId: null, targetFbPageId: null, pillarId: null });
          }}
        />
      </section>

      <section data-guide={GUIDE_ANCHORS.plannerComposerType.id}>
        <p className="mb-2 text-xs text-muted-foreground">
          {isCreating ? "Formatos (escolha um ou mais — cada um vira um rascunho com a mesma ideia)" : "Formato"}
        </p>
        <div className="flex flex-wrap gap-2">
          {POST_TYPES.map((type) => {
            const TypeIcon = POST_TYPE_META[type].icon;
            return (
              <OptionPill
                key={type}
                isSelected={isCreating ? values.formats.includes(type) : values.type === type}
                onSelect={() => toggleFormat(type)}
              >
                <TypeIcon className="size-3.5" /> {POST_TYPE_META[type].label}
              </OptionPill>
            );
          })}
        </div>
      </section>

      {isCreating && values.organizationId && (
        <ComposerAstroPanel
          organizationId={values.organizationId}
          instagramAccountId={values.targetNetworks.includes("INSTAGRAM") ? (values.targetIgAccountId ?? igAccounts[0]?.igUserId ?? null) : null}
          formats={values.formats}
          generatedByFormat={values.generatedByFormat}
          onGenerated={applyGenerated}
        />
      )}

      <section>
        <p className="mb-2 text-xs text-muted-foreground">Onde publicar</p>
        {client && client.accounts.length === 0 ? (
          <p className="rounded-2xl bg-warning/10 px-3 py-2 text-sm text-warning">
            Este cliente ainda não conectou o Instagram. Conecte em Satélites › Instagram para programar; por enquanto o post fica como rascunho.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {igAccounts.map((account) => (
              <OptionPill
                key={account.id}
                isSelected={values.targetNetworks.includes("INSTAGRAM") && (values.targetIgAccountId ?? igAccounts[0]?.igUserId) === account.igUserId}
                onSelect={() => {
                  if (account.canPublish === false) return;
                  update({ targetNetworks: Array.from(new Set([...values.targetNetworks, "INSTAGRAM" as const])), targetIgAccountId: account.igUserId });
                }}
              >
                @{account.igUsername ?? account.pageName ?? account.igUserId}
                {account.status === "NEEDS_RECONNECT" && <span className="text-[10px] text-destructive">reconectar</span>}
                {account.canPublish === false && <span className="text-[10px] text-warning">não publica</span>}
              </OptionPill>
            ))}
            {fbPages.map((page) => (
                <OptionPill
                  key={page.id}
                  isSelected={values.targetNetworks.includes("FACEBOOK") && (values.targetFbPageId ?? fbPages[0]?.pageId) === page.pageId}
                  onSelect={() => {
                    const isSelected = values.targetNetworks.includes("FACEBOOK") && values.targetFbPageId === page.pageId;
                    if (isSelected) toggleNetwork("FACEBOOK");
                    else update({ targetNetworks: Array.from(new Set([...values.targetNetworks, "FACEBOOK" as const])), targetFbPageId: page.pageId });
                  }}
                >
                  Página: {page.pageName}
                </OptionPill>
              ))}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Título interno</p>
          <Input value={values.title} onChange={(event) => update({ title: event.target.value })} placeholder="Ex.: Bastidores da loja" className="rounded-2xl" />
        </div>
        {pillars.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Pilar de conteúdo</p>
            <div className="flex flex-wrap gap-2">
              {pillars.map((pillar) => (
                <OptionPill key={pillar.id} isSelected={values.pillarId === pillar.id} onSelect={() => update({ pillarId: values.pillarId === pillar.id ? null : pillar.id })}>
                  {pillar.name}
                </OptionPill>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Objetivo / Gatilho</p>
            <Input value={values.objective} maxLength={200} onChange={(event) => update({ objective: event.target.value })} placeholder="Ex.: Dor + identificação + perda" className="rounded-2xl" />
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">CTA</p>
            <Input value={values.cta} maxLength={300} onChange={(event) => update({ cta: event.target.value })} placeholder="Ex.: Conheça pelo link da bio." className="rounded-2xl" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Roteiro</p>
          <Textarea
            value={values.script}
            onChange={(event) => update({ script: event.target.value })}
            placeholder="Abertura, desenvolvimento e chamada para ação. Para Reel e Story, descreva cada cena."
            className="min-h-32 rounded-2xl"
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          data-guide={GUIDE_ANCHORS.plannerPostSubmit.id}
          disabled={!values.organizationId || isSaving}
          onClick={() => onSubmit(values)}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40"
        >
          {isSaving ? "Salvando…" : draftCount > 1 ? `Criar ${draftCount} rascunhos` : submitLabel}
        </button>
      </div>
    </div>
  );
}
