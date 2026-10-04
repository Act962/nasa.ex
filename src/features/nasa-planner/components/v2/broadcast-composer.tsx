"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useCreatePlannerBroadcast, usePlannerBroadcastTemplates } from "../../hooks/use-planner-integrations";
import { ClientAvatar } from "./client-avatar";
import type { PlannerClient } from "./planner-v2-types";

/** Disparo de WhatsApp programado pelo Planner (spec 0060, RF-2): cliente → número → modelo → público → horário. */

type VariableSource = "recipientName" | "static";
type Temperature = "COLD" | "WARM" | "HOT" | "VERY_HOT";

const TEMPERATURE_OPTIONS: Array<{ value: Temperature; label: string }> = [
  { value: "COLD", label: "Frio" },
  { value: "WARM", label: "Morno" },
  { value: "HOT", label: "Quente" },
  { value: "VERY_HOT", label: "Muito quente" },
];

function Pill({ isSelected, onSelect, children }: { isSelected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", isSelected ? "bg-foreground font-semibold text-background" : "bg-panel")}
    >
      {children}
    </button>
  );
}

function BroadcastForm({ clients, initialDate, onDone }: { clients: PlannerClient[]; initialDate?: Date; onDone: () => void }) {
  const eligibleClients = clients.filter((client) => client.whatsappNumbers.length > 0 && client.permissions.canSchedule);
  const [organizationId, setOrganizationId] = useState(eligibleClients[0]?.id ?? "");
  const client = eligibleClients.find((candidate) => candidate.id === organizationId);
  const [trackingId, setTrackingId] = useState(client?.whatsappNumbers[0]?.trackingId ?? "");
  const [name, setName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [variableSources, setVariableSources] = useState<Array<{ source: VariableSource; value: string }>>([]);
  const [temperatures, setTemperatures] = useState<Temperature[]>([]);
  const [onlyActiveLeads, setOnlyActiveLeads] = useState(true);
  const [dateTimeValue, setDateTimeValue] = useState(format(initialDate ?? addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
  const { templates, isLoading: isLoadingTemplates, error: templatesError } = usePlannerBroadcastTemplates(organizationId || null, trackingId || null);
  const createBroadcast = useCreatePlannerBroadcast();
  const template = templates.find((candidate) => `${candidate.name}:${candidate.language}` === templateKey);

  const chooseClient = (nextClientId: string) => {
    setOrganizationId(nextClientId);
    setTrackingId(eligibleClients.find((candidate) => candidate.id === nextClientId)?.whatsappNumbers[0]?.trackingId ?? "");
    setTemplateKey("");
  };
  const chooseTemplate = (nextTemplateKey: string) => {
    setTemplateKey(nextTemplateKey);
    const nextTemplate = templates.find((candidate) => `${candidate.name}:${candidate.language}` === nextTemplateKey);
    setVariableSources(Array.from({ length: nextTemplate?.variableCount ?? 0 }, (_, index) => ({ source: index === 0 ? "recipientName" : "static", value: "" })));
  };

  const submit = () => {
    if (!template) return;
    createBroadcast.mutate(
      {
        organizationId,
        trackingId,
        name: name.trim() || template.name,
        templateName: template.name,
        templateLanguage: template.language,
        templateCategory: template.category,
        templateVariableCount: template.variableCount,
        bodyParams: variableSources.map((variable) => ({ source: variable.source, value: variable.source === "static" ? variable.value : "" })),
        audienceFilters: {
          ...(temperatures.length && { temperatureFilter: temperatures }),
          ...(onlyActiveLeads && { actionFilter: "ACTIVE" as const }),
        },
        scheduledAt: new Date(dateTimeValue),
      },
      {
        onSuccess: ({ broadcast }) => {
          toast.success(`Disparo programado para ${broadcast.totalRecipients} contatos.`);
          emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerBroadcastScheduled });
          onDone();
        },
        onError: (error) => toast.error(error.message || "Não deu para programar o disparo."),
      },
    );
  };

  if (eligibleClients.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhum cliente com número da API Oficial do WhatsApp conectado. Conecte um número nas Campanhas.</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <section>
        <p className="mb-2 text-xs text-muted-foreground">Cliente</p>
        <div className="flex flex-wrap gap-2">
          {eligibleClients.map((candidate) => (
            <Pill key={candidate.id} isSelected={candidate.id === organizationId} onSelect={() => chooseClient(candidate.id)}>
              <ClientAvatar name={candidate.name} logo={candidate.logo} clientIndex={clients.indexOf(candidate)} className="size-4 text-[7px] ring-1" />
              {candidate.name}
            </Pill>
          ))}
        </div>
      </section>
      {client && client.whatsappNumbers.length > 1 && (
        <section>
          <p className="mb-2 text-xs text-muted-foreground">Número que envia</p>
          <div className="flex flex-wrap gap-2">
            {client.whatsappNumbers.map((number) => (
              <Pill key={number.trackingId} isSelected={number.trackingId === trackingId} onSelect={() => { setTrackingId(number.trackingId); setTemplateKey(""); }}>
                {number.phoneNumber ?? number.trackingName}
              </Pill>
            ))}
          </div>
        </section>
      )}
      <section>
        <p className="mb-2 text-xs text-muted-foreground">Nome do disparo</p>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Lançamento de outubro" className="rounded-2xl" />
      </section>
      <section>
        <p className="mb-2 text-xs text-muted-foreground">Modelo aprovado</p>
        {isLoadingTemplates ? (
          <OrbitaSpinner className="size-4" />
        ) : templatesError ? (
          <p className="text-sm text-destructive">{templatesError.message}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum modelo aprovado neste número. Crie um nas Campanhas → Modelos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((candidate) => (
              <Pill key={`${candidate.name}:${candidate.language}`} isSelected={templateKey === `${candidate.name}:${candidate.language}`} onSelect={() => chooseTemplate(`${candidate.name}:${candidate.language}`)}>
                {candidate.name}
              </Pill>
            ))}
          </div>
        )}
        {template && (
          <div className="mt-3 space-y-2 rounded-2xl bg-panel p-3">
            <p className="whitespace-pre-wrap text-sm">{template.bodyText}</p>
            {variableSources.map((variable, variableIndex) => (
              <div key={variableIndex} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-10 text-muted-foreground">{`{{${variableIndex + 1}}}`}</span>
                <Pill isSelected={variable.source === "recipientName"} onSelect={() => setVariableSources((current) => current.map((item, index) => (index === variableIndex ? { ...item, source: "recipientName" } : item)))}>Nome do contato</Pill>
                <Pill isSelected={variable.source === "static"} onSelect={() => setVariableSources((current) => current.map((item, index) => (index === variableIndex ? { ...item, source: "static" } : item)))}>Texto fixo</Pill>
                {variable.source === "static" && (
                  <Input value={variable.value} onChange={(event) => setVariableSources((current) => current.map((item, index) => (index === variableIndex ? { ...item, value: event.target.value } : item)))} className="h-8 max-w-56 rounded-full" />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <p className="mb-2 text-xs text-muted-foreground">Público: leads do tracking deste número</p>
        <div className="flex flex-wrap gap-2">
          {TEMPERATURE_OPTIONS.map((option) => (
            <Pill
              key={option.value}
              isSelected={temperatures.includes(option.value)}
              onSelect={() => setTemperatures((current) => (current.includes(option.value) ? current.filter((value) => value !== option.value) : [...current, option.value]))}
            >
              {option.label}
            </Pill>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <Switch checked={onlyActiveLeads} onCheckedChange={setOnlyActiveLeads} /> Só leads em andamento (fora de ganhos e perdidos)
        </label>
      </section>
      <section>
        <p className="mb-2 text-xs text-muted-foreground">Data e hora do disparo</p>
        <Input type="datetime-local" value={dateTimeValue} onChange={(event) => setDateTimeValue(event.target.value)} className="max-w-64 rounded-2xl" />
      </section>
      <div className="flex justify-end">
        <button
          type="button"
          data-guide={GUIDE_ANCHORS.plannerBroadcastSubmit.id}
          disabled={!template || createBroadcast.isPending}
          onClick={submit}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40"
        >
          {createBroadcast.isPending ? "Programando…" : "Programar disparo"}
        </button>
      </div>
    </div>
  );
}

export function BroadcastComposer({ isOpen, clients, initialDate, onClose }: { isOpen: boolean; clients: PlannerClient[]; initialDate?: Date; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 sm:max-w-2xl sm:rounded-[22px]">
        <div className="border-b border-line py-3 pr-14 pl-5">
          <DialogTitle className="text-base font-bold">Disparo de WhatsApp</DialogTitle>
        </div>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto sm:max-h-[75vh]">
          {isOpen && <BroadcastForm clients={clients} initialDate={initialDate} onDone={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
