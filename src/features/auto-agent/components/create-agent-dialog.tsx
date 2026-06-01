"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/spinner";
import { BotIcon, PlusIcon, XIcon, SparklesIcon } from "lucide-react";
import { useCreateAgent } from "../hooks/use-agents";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
}

const DEFAULT_STOP_WORDS = [
  "não quero",
  "remover",
  "sair",
  "spam",
  "parar",
  "stop",
];

/**
 * Dialog de criação de agente IA — 5 steps:
 *  1. Pedido (rawPrompt) — o que o agente deve fazer
 *  2. Treinamento (systemInstructions) — manual da IA
 *  3. Spec preview (JSON editável) — review da spec gerada
 *  4. Follow-up + Salvaguardas — sliders + chips
 *  5. Confirmar — resumo + criar
 *
 * Fase 3 stub: spec é gerada SIMPLES (1 goal default) — UI funciona end-to-end
 * pro user criar agentes. Geração inteligente via LLM Astro fica pra Fase 4.
 */
export function CreateAgentDialog({ open, onOpenChange, trackingId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rawPrompt, setRawPrompt] = useState("");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [specJson, setSpecJson] = useState("");
  const [generating, setGenerating] = useState(false);

  // Follow-up + salvaguardas
  const [followUpDays, setFollowUpDays] = useState("1, 3, 5, 7");
  const [maxAttempts, setMaxAttempts] = useState([4]);
  const [maxStarsPerLead, setMaxStarsPerLead] = useState([50]);
  const [cooldownMinutes, setCooldownMinutes] = useState([30]);
  const [stopWords, setStopWords] = useState<string[]>(DEFAULT_STOP_WORDS);
  const [stopWordInput, setStopWordInput] = useState("");

  const create = useCreateAgent();

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setName("");
    setDescription("");
    setRawPrompt("");
    setSystemInstructions("");
    setSpecJson("");
    setFollowUpDays("1, 3, 5, 7");
    setMaxAttempts([4]);
    setMaxStarsPerLead([50]);
    setCooldownMinutes([30]);
    setStopWords(DEFAULT_STOP_WORDS);
  };

  // Step 2 → 3: gera spec a partir de rawPrompt + systemInstructions.
  // Por enquanto stub local; integração com Astro fica pra Fase 4.
  const handleGenerateSpec = () => {
    setGenerating(true);
    setTimeout(() => {
      const stub = {
        goals: [
          {
            id: "main",
            name: "Atendimento autônomo",
            description: rawPrompt.slice(0, 200),
            completionCriteria:
              "Lead aceitou proposta, demonstrou interesse claro, ou recusou expressamente",
            allowedTools: [
              "sendMessage",
              "addTagsToLead",
              "sendForm",
              "sendAgenda",
              "sendProposal",
              "transferToHuman",
              "markGoalAchieved",
            ],
            onSuccess: null,
            onFailure: null,
          },
        ],
        contextVars: [],
        stopWords,
      };
      setSpecJson(JSON.stringify(stub, null, 2));
      setGenerating(false);
      setStep(3);
    }, 800);
  };

  const handleAddStopWord = () => {
    const trimmed = stopWordInput.trim().toLowerCase();
    if (trimmed && !stopWords.includes(trimmed)) {
      setStopWords([...stopWords, trimmed]);
      setStopWordInput("");
    }
  };

  const handleRemoveStopWord = (sw: string) => {
    setStopWords(stopWords.filter((s) => s !== sw));
  };

  const handleConfirm = () => {
    let parsedSpec;
    try {
      parsedSpec = JSON.parse(specJson);
    } catch {
      alert("JSON da spec inválido — corrija no Step 3");
      return;
    }
    const followUpSchedule = followUpDays
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (followUpSchedule.length === 0) {
      alert("Defina pelo menos 1 dia de follow-up");
      return;
    }
    create.mutate(
      {
        name,
        description: description || undefined,
        trackingId,
        rawPrompt,
        systemInstructions,
        spec: parsedSpec,
        mode: "AUTO",
        followUpSchedule,
        maxAttempts: maxAttempts[0],
        maxStarsPerLead: maxStarsPerLead[0],
        cooldownMinutes: cooldownMinutes[0],
        stopWords,
      },
      {
        onSuccess: handleClose,
      },
    );
  };

  const canAdvanceStep1 = !!name.trim() && !!rawPrompt.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotIcon className="size-5 text-emerald-600" />
            Criar agente IA autônomo
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 5 ·{" "}
            {step === 1
              ? "O que o agente deve fazer"
              : step === 2
                ? "Como o agente deve se comportar"
                : step === 3
                  ? "Revise a configuração gerada"
                  : step === 4
                    ? "Follow-up e salvaguardas"
                    : "Confirme e crie"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* ── Step 1: Pedido ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Nome do agente</Label>
                <Input
                  placeholder="Ex: Closer Comercial"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="O que esse agente faz, em 1 linha"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>O que o agente deve fazer? *</Label>
                <Textarea
                  rows={8}
                  placeholder="Quero que quando o lead entrar e escolher a opção X, envie a proposta X e fique tentando com mensagens diferentes (sempre chamando o nome) por 1, 3, 5, 7 dias até que ele mostre interesse ou aceite. Se aceitar, adicione tag 'Aprovado', envie mensagem 'Bem-vindo!' e mova pro Tracking de Pós-Venda."
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva o objetivo do agente em linguagem natural. A IA vai
                  converter isso em uma sequência de objetivos (goals) que ele
                  vai perseguir automaticamente.
                </p>
              </div>
            </>
          )}

          {/* ── Step 2: Treinamento ────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Instruções de comportamento da IA</Label>
                <Textarea
                  rows={12}
                  placeholder={`Tom de voz: formal mas amigável, sempre tratamento "você"

O que pode fazer:
- Sempre chame o cliente pelo nome
- Ofereça desconto de até 10% se o cliente pedir
- Pode mencionar nossas garantias (30 dias)

O que NÃO pode fazer:
- Nunca prometa prazo de entrega sem confirmar
- Não fale de concorrentes
- Não envie áudio
- Se o cliente parecer menor de idade, transfira pra humano

Info da empresa:
- Horário: seg-sex 9h-18h
- Política: reembolso em 30 dias
- SAC: 0800-XXX-XXXX`}
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Manual da IA — define tom, restrições, info da empresa. Vai
                  ser anexado em TODOS os turns que ela responder.
                </p>
              </div>
            </>
          )}

          {/* ── Step 3: Spec preview (JSON) ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Spec gerada (JSON)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSpec}
                  disabled={generating}
                >
                  <SparklesIcon className="size-3.5" />
                  Re-gerar
                </Button>
              </div>
              {generating ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <Textarea
                  rows={16}
                  value={specJson}
                  onChange={(e) => setSpecJson(e.target.value)}
                  className="font-mono text-xs"
                />
              )}
              <p className="text-xs text-muted-foreground">
                JSON editável da spec. Defina goals, allowedTools (subset),
                onSuccess/onFailure pra encadear objetivos. Validado no submit.
              </p>
            </div>
          )}

          {/* ── Step 4: Follow-up + Salvaguardas ────────────────────── */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Schedule de follow-up (dias)</Label>
                <Input
                  placeholder="1, 3, 5, 7"
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lista de dias separados por vírgula. Cada tentativa de
                  follow-up usa um valor (1ª = 1 dia depois, 2ª = 3 dias, etc).
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Max tentativas:{" "}
                  <Badge variant="outline">{maxAttempts[0]}</Badge>
                </Label>
                <Slider
                  value={maxAttempts}
                  onValueChange={setMaxAttempts}
                  min={1}
                  max={10}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Depois de N tentativas sem resposta, marca como completo.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Budget de Stars por lead:{" "}
                  <Badge variant="outline">{maxStarsPerLead[0]}</Badge>
                </Label>
                <Slider
                  value={maxStarsPerLead}
                  onValueChange={setMaxStarsPerLead}
                  min={10}
                  max={500}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Atingiu o cap, transfere pra humano automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Cooldown entre mensagens:{" "}
                  <Badge variant="outline">{cooldownMinutes[0]} min</Badge>
                </Label>
                <Slider
                  value={cooldownMinutes}
                  onValueChange={setCooldownMinutes}
                  min={0}
                  max={120}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Tempo mínimo entre 2 mensagens do agente pro mesmo lead.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Palavras-chave de opt-out</Label>
                <div className="flex flex-wrap gap-1.5">
                  {stopWords.map((sw) => (
                    <Badge
                      key={sw}
                      variant="outline"
                      className="gap-1 pr-1"
                    >
                      {sw}
                      <button
                        onClick={() => handleRemoveStopWord(sw)}
                        className="hover:bg-destructive/10 rounded p-0.5"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar..."
                    value={stopWordInput}
                    onChange={(e) => setStopWordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddStopWord();
                      }
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddStopWord}
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se o lead mandar algo contendo qualquer dessas palavras, IA
                  transfere pra humano + tag opt-out automática.
                </p>
              </div>
            </>
          )}

          {/* ── Step 5: Confirmar ───────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
                <p>
                  <b>Nome:</b> {name}
                </p>
                {description && (
                  <p>
                    <b>Descrição:</b> {description}
                  </p>
                )}
                <p>
                  <b>Modo:</b> AUTO total
                </p>
                <p>
                  <b>Follow-up:</b> {followUpDays} dias
                </p>
                <p>
                  <b>Max tentativas:</b> {maxAttempts[0]}
                </p>
                <p>
                  <b>Budget/lead:</b> {maxStarsPerLead[0]} Stars
                </p>
                <p>
                  <b>Cooldown:</b> {cooldownMinutes[0]} min entre msgs
                </p>
                <p>
                  <b>Stop words:</b> {stopWords.length}{" "}
                  <span className="text-muted-foreground">
                    ({stopWords.slice(0, 3).join(", ")}
                    {stopWords.length > 3 ? "..." : ""})
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Após criar, o agente fica DESATIVADO. Use o toggle no card pra
                ativar quando quiser começar a operar.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as any)}
              disabled={create.isPending || generating}
            >
              Voltar
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          {step < 5 ? (
            <Button
              onClick={() => {
                if (step === 2) {
                  handleGenerateSpec();
                  return;
                }
                setStep((s) => (s + 1) as any);
              }}
              disabled={
                (step === 1 && !canAdvanceStep1) ||
                (step === 3 && !specJson.trim()) ||
                generating
              }
            >
              {step === 2 ? "Gerar spec" : "Próximo"}
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={create.isPending}>
              {create.isPending ? "Criando..." : "Criar agente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
