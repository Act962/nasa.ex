"use client";

/**
 * Forms visuais por NodeType do Modo Agente IA.
 *
 * Cada NodeType ganha um form dedicado (não-JSON) com fields nomeados,
 * tooltips e validação visual. Os 14 NodeTypes são agrupados em 5 famílias
 * pra reduzir duplicação:
 *
 *  - LogicForm     → IF_CONDITION, SWITCH_CASE, LOOP_OVER, MERGE, WAIT_FOR_EVENT
 *  - AiForm        → AI_DECISION, AI_GENERATE_TEXT, AI_VISION, READ_PDF
 *  - DataForm      → SET_VARIABLE, CALL_WORKFLOW
 *  - AppForm       → CHECK_PAYMENT, SEND_VOICE, SEND_MEDIA
 *  - TriggerForm   → PAYMENT_RECEIVED, MESSAGE_INCOMING, WEBHOOK_EXTERNAL
 *
 * Cada form recebe `data` (atual) + `onChange(nextData)`. O AgentNode
 * gerencia o estado e persiste via setNodes do React Flow.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * Select reutilizável pra organizationId — substitui o Input antigo onde
 * o user precisava digitar/colar o ID manualmente. Auto-popula com a org
 * ativa quando o campo está vazio.
 */
function OrganizationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: orgs } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  // Auto-popula com a org ativa quando vazio (UX — operador raramente
  // precisa escolher outra org pra cobrança de Stars)
  if (!value && activeOrg?.id) {
    // setState dentro do render via effect-like trick — onChange seta
    // o estado no parent que re-renderiza com value preenchido.
    queueMicrotask(() => onChange(activeOrg.id));
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione a organização" />
      </SelectTrigger>
      <SelectContent>
        {(orgs ?? []).map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type FormProps = {
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

// ─── Helpers ───────────────────────────────────────

function s(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}
function n(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}
function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─── Helper: cabeçalho com hint ─────────────────────

function FormHeader({ hint }: { hint: string }) {
  return (
    <p className="text-xs text-muted-foreground italic mb-2 leading-snug">
      {hint}
    </p>
  );
}

// ─── IF_CONDITION + SWITCH_CASE + LOOP_OVER + MERGE + WAIT_FOR_EVENT ─

export function LogicForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "IF_CONDITION") {
    const conditions = arr<{ field: string; operator: string; value: unknown }>(
      data.conditions,
    );
    const combinator = (data.combinator as "AND" | "OR") ?? "AND";

    const addCondition = () =>
      onChange({
        ...data,
        conditions: [...conditions, { field: "", operator: "eq", value: "" }],
      });

    const updateCondition = (
      idx: number,
      key: "field" | "operator" | "value",
      value: unknown,
    ) => {
      const next = [...conditions];
      next[idx] = { ...next[idx], [key]: value };
      onChange({ ...data, conditions: next });
    };

    const removeCondition = (idx: number) => {
      onChange({
        ...data,
        conditions: conditions.filter((_, i) => i !== idx),
      });
    };

    return (
      <div className="space-y-3">
        <FormHeader hint="Avalia condições contra o contexto (lead, vars, trigger). Tem 2 saídas: 'true' e 'false'." />

        <div className="space-y-2">
          <Label>Combinador</Label>
          <Select
            value={combinator}
            onValueChange={(v) => onChange({ ...data, combinator: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">Todas as condições (AND)</SelectItem>
              <SelectItem value="OR">Qualquer condição (OR)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Condições</Label>
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="campo (ex: lead.tag)"
                value={s(c.field)}
                onChange={(e) => updateCondition(i, "field", e.target.value)}
                className="flex-1 text-xs"
              />
              <Select
                value={s(c.operator, "eq")}
                onValueChange={(v) => updateCondition(i, "operator", v)}
              >
                <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">=</SelectItem>
                  <SelectItem value="neq">≠</SelectItem>
                  <SelectItem value="gt">&gt;</SelectItem>
                  <SelectItem value="gte">≥</SelectItem>
                  <SelectItem value="lt">&lt;</SelectItem>
                  <SelectItem value="lte">≤</SelectItem>
                  <SelectItem value="contains">contém</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="exists">existe</SelectItem>
                  <SelectItem value="empty">vazio</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="valor"
                value={s(c.value)}
                onChange={(e) => updateCondition(i, "value", e.target.value)}
                className="flex-1 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeCondition(i)}
              >
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addCondition}>
            <PlusIcon className="size-3.5" />
            Adicionar condição
          </Button>
        </div>
      </div>
    );
  }

  if (nodeType === "LOOP_OVER") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Itera sobre um array do contexto. 2 saídas: 'loop' (cada item) e 'done' (final)." />
        <div className="space-y-2">
          <Label>Caminho do array</Label>
          <Input
            placeholder="ex: vars.followupDays"
            value={s(data.arrayPath)}
            onChange={(e) => onChange({ ...data, arrayPath: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Máximo de iterações</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={n(data.maxIterations, 4)}
            onChange={(e) =>
              onChange({ ...data, maxIterations: Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  if (nodeType === "WAIT_FOR_EVENT") {
    // Preset = atalho pra cenários "Sem 1ª resposta" / "Em conversa idle"
    // já cobertos pelo Idle Automation engine (Tracking → Configurações →
    // Interações). Quando preset != "custom", a engine de idle emite o
    // evento correto com leadId, e a WAIT_FOR_EVENT desperta por match.
    //
    // PRESET_EVENT_MAP precisa bater com os events emitidos em
    // `src/inngest/functions/triggers/idle-automation.ts`.
    const PRESET_EVENT_MAP: Record<string, string> = {
      "no-first-response": "agent-workflow/lead-no-first-response",
      "in-conv-idle": "agent-workflow/lead-idle",
      "message-incoming": "agent-workflow/message-incoming",
      "lead-tagged": "agent-workflow/lead-tagged",
      "lead-status-changed": "agent-workflow/lead-status-changed",
      "payment-received": "agent-workflow/payment-received",
      "ai-finished": "agent-workflow/ai-finished",
      "webhook-external": "agent-workflow/webhook-external",
    };
    const currentPreset = s(data.preset, "custom");
    const handlePresetChange = (preset: string) => {
      if (preset === "custom") {
        // Mantém eventName atual, só remove o marker
        const { preset: _drop, ...rest } = data;
        void _drop;
        onChange(rest);
      } else {
        onChange({
          ...data,
          preset,
          eventName: PRESET_EVENT_MAP[preset] ?? "",
        });
      }
    };
    const isPreset = currentPreset !== "custom";
    return (
      <div className="space-y-3">
        <FormHeader hint="Pausa o fluxo até um evento. Use um preset pra cenários comuns ou 'Custom' pra evento Inngest específico." />
        <div className="space-y-2">
          <Label>Tipo de espera</Label>
          <Select value={currentPreset} onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Evento Inngest personalizado</SelectItem>
              <SelectItem value="message-incoming">
                Nova mensagem do lead
              </SelectItem>
              <SelectItem value="no-first-response">
                Sem 1ª resposta do lead
              </SelectItem>
              <SelectItem value="in-conv-idle">
                Conversa ociosa (lead parou de responder)
              </SelectItem>
              <SelectItem value="lead-tagged">
                Lead recebeu tag
              </SelectItem>
              <SelectItem value="lead-status-changed">
                Lead mudou de status
              </SelectItem>
              <SelectItem value="payment-received">
                Pagamento recebido
              </SelectItem>
              <SelectItem value="ai-finished">
                IA encerrou atendimento
              </SelectItem>
              <SelectItem value="webhook-external">
                Webhook externo
              </SelectItem>
            </SelectContent>
          </Select>
          {isPreset &&
            (currentPreset === "no-first-response" ||
              currentPreset === "in-conv-idle") && (
              <p className="text-[11px] text-yellow-700 dark:text-yellow-400 leading-snug">
                ⚠ Esse preset depende da Idle Automation estar ativa em
                Tracking → Configurações → Interações. O tempo de espera é
                controlado lá (e usado como timeout aqui).
              </p>
            )}
        </div>
        {!isPreset && (
          <div className="space-y-2">
            <Label>Nome do evento</Label>
            <Input
              placeholder="ex: message-incoming"
              value={s(data.eventName)}
              onChange={(e) =>
                onChange({ ...data, eventName: e.target.value })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Sem prefixo, ganha `agent-workflow/` automaticamente.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label>Timeout (minutos)</Label>
          <Input
            type="number"
            min={1}
            value={n(data.timeoutMinutes, 1440)}
            onChange={(e) =>
              onChange({ ...data, timeoutMinutes: Number(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground">
            Default: 1440 (24h). Após o timeout, segue pelo "main".
          </p>
        </div>
      </div>
    );
  }

  if (nodeType === "SWITCH_CASE") {
    const cases = arr<{ value: string; output: string }>(data.cases);
    const addCase = () =>
      onChange({ ...data, cases: [...cases, { value: "", output: "case_" + (cases.length + 1) }] });
    const updateCase = (idx: number, key: "value" | "output", value: string) => {
      const next = [...cases];
      next[idx] = { ...next[idx], [key]: value };
      onChange({ ...data, cases: next });
    };
    const removeCase = (idx: number) =>
      onChange({ ...data, cases: cases.filter((_, i) => i !== idx) });
    return (
      <div className="space-y-3">
        <FormHeader hint="N saídas com base no valor de um campo. Cada caso vira uma saída nomeada." />
        <div className="space-y-2">
          <Label>Campo a avaliar</Label>
          <Input
            placeholder="ex: lead.tag"
            value={s(data.field)}
            onChange={(e) => onChange({ ...data, field: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Casos</Label>
          {cases.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="valor"
                value={s(c.value)}
                onChange={(e) => updateCase(i, "value", e.target.value)}
                className="flex-1 text-xs"
              />
              <Input
                placeholder="nome do output"
                value={s(c.output)}
                onChange={(e) => updateCase(i, "output", e.target.value)}
                className="flex-1 text-xs"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => removeCase(i)}>
                <Trash2Icon className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCase}>
            <PlusIcon className="size-3.5" /> Adicionar caso
          </Button>
        </div>
      </div>
    );
  }

  // MERGE
  return (
    <div>
      <FormHeader hint="Consolida múltiplos ramos paralelos. Não tem config — só conecta entradas e segue." />
      <Badge variant="outline">Sem configuração necessária</Badge>
    </div>
  );
}

// ─── AI_DECISION + AI_GENERATE_TEXT + AI_VISION + READ_PDF ─────────

export function AiForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "AI_DECISION") {
    const branches = arr<{ id: string; label: string; description?: string }>(
      data.branches,
    );
    const updateBranch = (i: number, key: "id" | "label" | "description", v: string) => {
      const next = [...branches];
      next[i] = { ...next[i], [key]: v };
      onChange({ ...data, branches: next });
    };
    return (
      <div className="space-y-3">
        <FormHeader hint="Astro escolhe um dos ramos com base no contexto. Cada ramo vira uma saída." />
        <div className="space-y-2">
          <Label>Instrução pra IA</Label>
          <Textarea
            rows={3}
            value={s(data.prompt)}
            onChange={(e) => onChange({ ...data, prompt: e.target.value })}
            placeholder="ex: O lead aceitou a proposta? Considere variações de escrita."
          />
        </div>
        <div className="space-y-2">
          <Label>Empresa (cobrança em ★)</Label>
          <OrganizationSelect
            value={s(data.organizationId)}
            onChange={(id) => onChange({ ...data, organizationId: id })}
          />
        </div>
        <div className="space-y-2">
          <Label>Ramos de decisão</Label>
          {branches.map((b, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1">
              <div className="flex gap-2">
                <Input
                  className="text-xs"
                  placeholder="id (ex: accepted)"
                  value={s(b.id)}
                  onChange={(e) => updateBranch(i, "id", e.target.value)}
                />
                <Input
                  className="text-xs"
                  placeholder="rótulo"
                  value={s(b.label)}
                  onChange={(e) => updateBranch(i, "label", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange({ ...data, branches: branches.filter((_, x) => x !== i) })}
                >
                  <Trash2Icon className="size-3.5 text-destructive" />
                </Button>
              </div>
              <Input
                className="text-xs"
                placeholder="descrição (pista pra IA)"
                value={s(b.description)}
                onChange={(e) => updateBranch(i, "description", e.target.value)}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...data, branches: [...branches, { id: "", label: "", description: "" }] })}
          >
            <PlusIcon className="size-3.5" /> Adicionar ramo
          </Button>
        </div>
      </div>
    );
  }

  if (nodeType === "AI_GENERATE_TEXT") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Gera texto contextualizado. Output em vars.lastGeneratedText." />
        <div className="space-y-2">
          <Label>Instrução / Briefing</Label>
          <Textarea
            rows={4}
            value={s(data.prompt)}
            onChange={(e) => onChange({ ...data, prompt: e.target.value })}
            placeholder="ex: Tentativa #{{vars.loopIndex}} de follow-up para {{lead.name}}. Mensagem curta, tom amigável, varia abordagem..."
          />
        </div>
        <div className="space-y-2">
          <Label>Tom</Label>
          <Input
            value={s(data.tone, "amigável e direto")}
            onChange={(e) => onChange({ ...data, tone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Máximo de tokens</Label>
          <Input
            type="number"
            min={50}
            max={2000}
            value={n(data.maxTokens, 300)}
            onChange={(e) => onChange({ ...data, maxTokens: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Empresa (cobrança em ★)</Label>
          <OrganizationSelect
            value={s(data.organizationId)}
            onChange={(id) => onChange({ ...data, organizationId: id })}
          />
        </div>
      </div>
    );
  }

  if (nodeType === "AI_VISION") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Analisa imagem do contexto (URL). Output em vars.lastVisionResult." />
        <div className="space-y-2">
          <Label>Caminho da imagem (no contexto)</Label>
          <Input
            placeholder="ex: vars.lastUploadedImage"
            value={s(data.imagePath)}
            onChange={(e) => onChange({ ...data, imagePath: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>O que extrair</Label>
          <Textarea
            rows={3}
            value={s(data.instruction)}
            onChange={(e) => onChange({ ...data, instruction: e.target.value })}
            placeholder="ex: Identifique se é comprovante de pagamento e extraia valor + data."
          />
        </div>
        <div className="space-y-2">
          <Label>Empresa (cobrança em ★)</Label>
          <OrganizationSelect
            value={s(data.organizationId)}
            onChange={(id) => onChange({ ...data, organizationId: id })}
          />
        </div>
      </div>
    );
  }

  // READ_PDF
  return (
    <div className="space-y-3">
      <FormHeader hint="Extrai texto de PDF + interpreta via IA. Cap 20 páginas / 5MB." />
      <div className="space-y-2">
        <Label>Caminho do PDF (no contexto)</Label>
        <Input
          placeholder="ex: vars.lastUploadedPdf"
          value={s(data.pdfPath)}
          onChange={(e) => onChange({ ...data, pdfPath: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Instrução (opcional)</Label>
        <Textarea
          rows={3}
          value={s(data.instruction)}
          onChange={(e) => onChange({ ...data, instruction: e.target.value })}
          placeholder="ex: Resuma e liste tópicos-chave."
        />
      </div>
      <div className="space-y-2">
        <Label>Empresa (cobrança em ★)</Label>
        <OrganizationSelect
          value={s(data.organizationId)}
          onChange={(id) => onChange({ ...data, organizationId: id })}
        />
      </div>
    </div>
  );
}

// ─── SET_VARIABLE + CALL_WORKFLOW ──────────────────

export function DataForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "SET_VARIABLE") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Cria/atualiza uma variável no contexto. Acessível em nós seguintes via {{vars.<nome>}}." />
        <div className="space-y-2">
          <Label>Nome da variável</Label>
          <Input
            placeholder="ex: followupDays"
            value={s(data.name)}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Valor (JSON ou texto)</Label>
          <Textarea
            rows={3}
            value={
              typeof data.value === "string"
                ? data.value
                : JSON.stringify(data.value ?? "")
            }
            onChange={(e) => {
              const raw = e.target.value;
              // Tenta parsear JSON; se falhar, salva como string
              try {
                onChange({ ...data, value: JSON.parse(raw) });
              } catch {
                onChange({ ...data, value: raw });
              }
            }}
            placeholder='ex: [1,3,5,7] ou "texto"'
          />
        </div>
      </div>
    );
  }

  // CALL_WORKFLOW
  return (
    <div className="space-y-3">
      <FormHeader hint="Executa outro workflow como sub-rotina. Cap de 5 níveis pra evitar recursão." />
      <div className="space-y-2">
        <Label>ID do sub-workflow</Label>
        <Input
          placeholder="workflow id..."
          value={s(data.workflowId)}
          onChange={(e) => onChange({ ...data, workflowId: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─── CHECK_PAYMENT + SEND_VOICE + SEND_MEDIA ──────

export function AppForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "WEB_SEARCH") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Busca informações ATUAIS na web (preços, dados públicos, validações). Default Gemini (free tier), fallback OpenAI. Output em vars.lastSearchSummary." />
        <div className="space-y-2">
          <Label>Consulta</Label>
          <Textarea
            rows={2}
            value={s(data.query)}
            onChange={(e) => onChange({ ...data, query: e.target.value })}
            placeholder="ex: preço atual {{vars.produtoMencionado}} no mercado brasileiro"
          />
          <p className="text-xs text-muted-foreground">
            Suporta interpolação ({"{{vars.x}}, {{lead.name}}"}).
          </p>
        </div>
        <div className="space-y-2">
          <Label>Provider preferido</Label>
          <Select
            value={s(data.preferredProvider, "gemini")}
            onValueChange={(v) => onChange({ ...data, preferredProvider: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini (gratuito até 1500/dia)</SelectItem>
              <SelectItem value="openai">OpenAI ($25/mil buscas)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se o preferido falhar, faz fallback automático pro outro.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Empresa (cobrança em ★)</Label>
          <OrganizationSelect
            value={s(data.organizationId)}
            onChange={(id) => onChange({ ...data, organizationId: id })}
          />
        </div>
      </div>
    );
  }

  if (nodeType === "CHECK_PAYMENT") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Consulta status de pagamento Stripe/Asaas. 3 saídas: 'paid', 'pending', 'failed'." />
        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select
            value={s(data.provider, "STRIPE")}
            onValueChange={(v) => onChange({ ...data, provider: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STRIPE">Stripe</SelectItem>
              <SelectItem value="ASAAS">Asaas (PIX/Boleto)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ID do pagamento (opcional)</Label>
          <Input
            placeholder="paymentId ou {{trigger.externalId}}"
            value={s(data.paymentId)}
            onChange={(e) => onChange({ ...data, paymentId: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>OU ID do lead</Label>
          <Input
            placeholder="leadId ou {{lead.id}}"
            value={s(data.leadId)}
            onChange={(e) => onChange({ ...data, leadId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Se informar leadId, busca último pagamento desse lead.
          </p>
        </div>
      </div>
    );
  }

  if (nodeType === "SEND_VOICE") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Gera áudio TTS (OpenAI) e envia como ptt (mensagem de voz) no WhatsApp." />
        <div className="space-y-2">
          <Label>Texto pra falar</Label>
          <Textarea
            rows={3}
            value={s(data.text)}
            onChange={(e) => onChange({ ...data, text: e.target.value })}
            placeholder="ex: Olá {{lead.name}}, seu pagamento foi confirmado!"
          />
        </div>
        <div className="space-y-2">
          <Label>OU caminho do texto no contexto</Label>
          <Input
            placeholder="ex: vars.lastGeneratedText"
            value={s(data.textPath)}
            onChange={(e) => onChange({ ...data, textPath: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Voz</Label>
          <Select
            value={s(data.voice, "shimmer")}
            onValueChange={(v) => onChange({ ...data, voice: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alloy">Alloy</SelectItem>
              <SelectItem value="echo">Echo</SelectItem>
              <SelectItem value="fable">Fable</SelectItem>
              <SelectItem value="onyx">Onyx</SelectItem>
              <SelectItem value="nova">Nova (feminina)</SelectItem>
              <SelectItem value="shimmer">Shimmer (feminina suave)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // SEND_MEDIA
  return (
    <div className="space-y-3">
      <FormHeader hint="Envia imagem/vídeo/áudio/documento ao lead via WhatsApp (uazapi)." />
      <div className="space-y-2">
        <Label>Tipo de mídia</Label>
        <Select
          value={s(data.mediaType, "IMAGE")}
          onValueChange={(v) => onChange({ ...data, mediaType: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IMAGE">Imagem</SelectItem>
            <SelectItem value="VIDEO">Vídeo</SelectItem>
            <SelectItem value="AUDIO">Áudio</SelectItem>
            <SelectItem value="DOCUMENT">Documento</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>URL da mídia</Label>
        <Input
          placeholder="https://... ou {{vars.fileUrl}}"
          value={s(data.url)}
          onChange={(e) => onChange({ ...data, url: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Legenda (opcional)</Label>
        <Textarea
          rows={2}
          value={s(data.caption)}
          onChange={(e) => onChange({ ...data, caption: e.target.value })}
          placeholder="ex: Sua proposta, {{lead.name}}"
        />
      </div>
      {s(data.mediaType, "IMAGE") === "DOCUMENT" && (
        <div className="space-y-2">
          <Label>Nome do arquivo</Label>
          <Input
            placeholder="ex: proposta.pdf"
            value={s(data.fileName)}
            onChange={(e) => onChange({ ...data, fileName: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// ─── PAYMENT_RECEIVED + MESSAGE_INCOMING + WEBHOOK_EXTERNAL ─

export function TriggerForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "PAYMENT_RECEIVED") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Dispara quando pagamento Stripe/Asaas é confirmado pra um lead da org." />
        <div className="space-y-2">
          <Label>Filtrar por provedor (opcional)</Label>
          <Select
            value={s(data.provider, "ANY")}
            onValueChange={(v) => onChange({ ...data, provider: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Qualquer</SelectItem>
              <SelectItem value="STRIPE">Apenas Stripe</SelectItem>
              <SelectItem value="ASAAS">Apenas Asaas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor mínimo (centavos, opcional)</Label>
          <Input
            type="number"
            min={0}
            value={n(data.minAmountCents)}
            onChange={(e) =>
              onChange({ ...data, minAmountCents: Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  if (nodeType === "MESSAGE_INCOMING") {
    return (
      <div className="space-y-3">
        <FormHeader hint="Dispara quando o lead envia mensagem nova no WhatsApp." />
        <div className="space-y-2">
          <Label>Filtro por palavras (opcional)</Label>
          <Input
            placeholder="ex: comprar, quero, aceito (separadas por vírgula)"
            value={(arr<string>(data.containsAny) ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...data,
                containsAny: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Dispara só se a msg do lead contiver alguma destas palavras.
            Deixe vazio pra disparar em toda mensagem.
          </p>
        </div>
      </div>
    );
  }

  // WEBHOOK_EXTERNAL
  return (
    <div className="space-y-3">
      <FormHeader hint="Dispara quando um sistema externo (Zapier, Make, custom) faz POST no endpoint público." />
      <div className="space-y-2">
        <Label>Secret (header X-Agent-Secret)</Label>
        <Input
          placeholder="(opcional — gera automaticamente se vazio)"
          value={s(data.secret)}
          onChange={(e) => onChange({ ...data, secret: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Endpoint: <code>POST /api/agent-webhook/[workflowId]</code>
      </p>
    </div>
  );
}

// ─── Dispatcher: escolhe form certo por NodeType ────

const LOGIC = new Set([
  "IF_CONDITION",
  "SWITCH_CASE",
  "LOOP_OVER",
  "MERGE",
  "WAIT_FOR_EVENT",
]);
const AI = new Set(["AI_DECISION", "AI_GENERATE_TEXT", "AI_VISION", "READ_PDF"]);
const DATA = new Set(["SET_VARIABLE", "CALL_WORKFLOW"]);
const APPS = new Set(["CHECK_PAYMENT", "SEND_VOICE", "SEND_MEDIA", "WEB_SEARCH"]);
const TRIGGERS = new Set([
  "PAYMENT_RECEIVED",
  "MESSAGE_INCOMING",
  "WEBHOOK_EXTERNAL",
]);

export function AgentNodeForm({
  nodeType,
  data,
  onChange,
}: {
  nodeType: string;
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  if (LOGIC.has(nodeType))
    return <LogicForm nodeType={nodeType} data={data} onChange={onChange} />;
  if (AI.has(nodeType))
    return <AiForm nodeType={nodeType} data={data} onChange={onChange} />;
  if (DATA.has(nodeType))
    return <DataForm nodeType={nodeType} data={data} onChange={onChange} />;
  if (APPS.has(nodeType))
    return <AppForm nodeType={nodeType} data={data} onChange={onChange} />;
  if (TRIGGERS.has(nodeType))
    return <TriggerForm nodeType={nodeType} data={data} onChange={onChange} />;

  // Fallback: JSON cru (NodeType desconhecido)
  return (
    <div className="space-y-2">
      <Label>Configuração (JSON)</Label>
      <Textarea
        rows={10}
        className="font-mono text-xs"
        value={JSON.stringify(data, null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* ignora durante edição */
          }
        }}
      />
    </div>
  );
}
