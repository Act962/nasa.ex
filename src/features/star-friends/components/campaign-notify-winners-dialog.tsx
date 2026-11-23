"use client";

import { useMemo, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifyStarFriendsWinners, useStarFriendsNoticeTemplates } from "../hooks/use-star-friends-campaign";
import {
  WINNER_VARIABLE_LABELS,
  WINNER_VARIABLE_SOURCES,
  hasEmptyFixedText,
  positionsMissingPrize,
  renderTemplateBody,
  winnerVariableValues,
  type WinnerVariable,
  type WinnerVariableSource,
} from "../utils/winner-notice";

// Aviso dos ganhadores pelo WhatsApp (spec 0148): escolhe o modelo aprovado, diz o que entra em cada
// variável, dá nome aos prêmios e confere a prévia antes de mandar para todos de uma vez.

type NoticeCampaign = { id: string; name: string; trackingId: string | null; prizeNames: string[] };
type PendingWinner = { id: string; position: number; code: string; name: string; phone: string };

const DEFAULT_SOURCES: WinnerVariableSource[] = ["first_name", "code", "prize"];
const PREVIEW_LIMIT = 3;

function defaultVariables(count: number): WinnerVariable[] {
  return Array.from({ length: count }, (_, index) => ({ source: DEFAULT_SOURCES[index] ?? "fixed", fixedText: "" }));
}

export function CampaignNotifyWinnersDialog({ campaign, winners }: { campaign: NoticeCampaign; winners: PendingWinner[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [variables, setVariables] = useState<WinnerVariable[]>([]);
  const [prizeNames, setPrizeNames] = useState<string[]>(campaign.prizeNames);
  const templatesQuery = useStarFriendsNoticeTemplates(campaign.trackingId, isOpen);
  const notify = useNotifyStarFriendsWinners();

  const templates = useMemo(
    () => (templatesQuery.data?.templates ?? []).filter((template) => template.sendable && template.headerVariableCount === 0),
    [templatesQuery.data],
  );
  const template = templates.find((option) => `${option.name}|${option.language}` === templateKey) ?? null;
  const isUsingPrize = variables.some((variable) => variable.source === "prize");
  const missingPositions = template ? positionsMissingPrize({ variables, winners, prizeNames }) : [];
  const isFixedTextMissing = hasEmptyFixedText(variables);
  const canSend = Boolean(template) && missingPositions.length === 0 && !isFixedTextMissing && !notify.isPending;

  const chooseTemplate = (key: string) => {
    setTemplateKey(key);
    const chosen = templates.find((option) => `${option.name}|${option.language}` === key);
    setVariables(defaultVariables(chosen?.bodyVariableCount ?? 0));
  };

  const updateVariable = (index: number, change: Partial<WinnerVariable>) =>
    setVariables((current) => current.map((variable, variableIndex) => (variableIndex === index ? { ...variable, ...change } : variable)));

  const updatePrize = (position: number, name: string) =>
    setPrizeNames((current) => {
      const next = [...current];
      while (next.length < position) next.push("");
      next[position - 1] = name;
      return next;
    });

  const previewOf = (winner: PendingWinner) => {
    const body = template ? renderTemplateBody(template.bodyText, winnerVariableValues({ variables, winner, campaignName: campaign.name, prizeNames })) : "";
    return template?.headerText ? `*${template.headerText}*\n\n${body}` : body;
  };

  const send = () => {
    if (!template) return;
    notify.mutate(
      { campaignId: campaign.id, templateName: template.name, languageCode: template.language, variables, prizeNames },
      {
        onSuccess: (result) => {
          const failures = result.results.filter((item) => !item.isSent);
          if (failures.length === 0) toast.success(`${result.sentCount} ganhador(es) avisado(s) pelo WhatsApp.`);
          else toast.warning(`${result.sentCount} avisado(s); ${failures.length} falharam. O motivo aparece na lista e dá para tentar de novo.`);
          setIsOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (nextIsOpen) setPrizeNames(campaign.prizeNames);
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 rounded-full px-5" data-guide={GUIDE_ANCHORS.starFriendsNotifyWinners.id}>
          <MessageCircleHeart className="size-4" /> Avisar ganhadores ({winners.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Avisar ganhadores pelo WhatsApp</DialogTitle>
          <DialogDescription>
            Vai para {winners.length} ganhador(es) ainda não avisado(s), pelo número da campanha. Depois de avisado, o ganhador não pode mais ser
            revogado.
          </DialogDescription>
        </DialogHeader>

        {!campaign.trackingId ? (
          <p className="rounded-[14px] bg-warning/10 p-3 text-sm">Escolha o funil do WhatsApp na configuração da campanha: o aviso sai pelo número dele.</p>
        ) : templatesQuery.isLoading ? (
          <OrbitaSpinner className="mx-auto my-6 size-6" />
        ) : templatesQuery.isError ? (
          <p className="rounded-[14px] bg-destructive/10 p-3 text-sm">{templatesQuery.error.message}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Modelo aprovado</FieldLabel>
              <Select value={templateKey} onValueChange={chooseTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={templates.length === 0 ? "Nenhum modelo aprovado que dê para enviar" : "Escolha o modelo"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((option) => (
                    <SelectItem key={`${option.name}|${option.language}`} value={`${option.name}|${option.language}`}>
                      {option.name} · {option.language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Modelos com botão ou com variável no cabeçalho não aparecem: o envio não preenche esses campos.</FieldDescription>
            </Field>

            {template && variables.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">O que entra em cada variável</p>
                {variables.map((variable, index) => (
                  <div key={index} className="grid grid-cols-[3rem_1fr] items-center gap-2 sm:grid-cols-[3rem_1fr_1fr]">
                    <span className="font-mono text-sm text-muted-foreground">{`{{${index + 1}}}`}</span>
                    <Select value={variable.source} onValueChange={(source) => updateVariable(index, { source: source as WinnerVariableSource })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WINNER_VARIABLE_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {WINNER_VARIABLE_LABELS[source]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {variable.source === "fixed" && (
                      <Input
                        className="col-span-2 sm:col-span-1"
                        placeholder="Ex.: 12/12/2026"
                        value={variable.fixedText ?? ""}
                        onChange={(event) => updateVariable(index, { fixedText: event.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {template && isUsingPrize && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Prêmio de cada posição</p>
                {winners.map((winner) => (
                  <div key={winner.id} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                    <span className="text-sm font-semibold">{winner.position}º</span>
                    <Input
                      placeholder={`Prêmio de ${winner.name.split(" ")[0]}`}
                      value={prizeNames[winner.position - 1] ?? ""}
                      onChange={(event) => updatePrize(winner.position, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {template && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Prévia</p>
                {winners.slice(0, PREVIEW_LIMIT).map((winner) => (
                  <div key={winner.id} className="rounded-[14px] border border-line bg-muted/40 p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {winner.position}º · {winner.name} · {winner.phone}
                    </p>
                    <p className="whitespace-pre-wrap">{previewOf(winner)}</p>
                  </div>
                ))}
                {winners.length > PREVIEW_LIMIT && <p className="text-xs text-muted-foreground">E mais {winners.length - PREVIEW_LIMIT} ganhador(es).</p>}
                {missingPositions.length > 0 && (
                  <p className="text-sm text-destructive">Falta o nome do prêmio: {missingPositions.map((position) => `${position}º`).join(", ")}.</p>
                )}
                {isFixedTextMissing && <p className="text-sm text-destructive">Preencha o texto fixo das variáveis.</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSend} onClick={send}>
            {notify.isPending && <OrbitaSpinner className="size-4" />} Enviar para {winners.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
