"use client";

// Formulários dos blocos do Fluxo de Atendimento (spec 0139). Abertos pelo AgentNode, como os do modo agente.
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiAgentAssistantSection, AiAgentCapabilitiesSection } from "./editor/ai-agent-assistant";
import { VariableTextarea } from "./editor/variable-textarea";
import { ATTENDANCE_ENTRY_LABELS, ATTENDANCE_ENTRY_MODES, parseAttendanceEntry, type AttendanceEntryMode } from "../lib/entry-rules";
import {
  ANSWER_TYPES,
  ANSWER_TYPE_LABELS,
  LEAD_FIELD_OPTIONS,
  parseAiAgent,
  parseAskQuestion,
  parseRandomizerPaths,
  resolveReplyDeadline,
  type AiAgentField,
  type AiAgentIntent,
  type AnswerType,
  type RandomizerPath,
} from "../lib/nodes";

type NodeData = Record<string, unknown>;
type FormProps = { data: NodeData; onChange: (data: NodeData) => void };

const NO_FIELD = "__none__";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LeadFieldSelect({ value, onChange, emptyLabel }: { value: string | null; onChange: (value: string | null) => void; emptyLabel: string }) {
  return (
    <Select value={value ?? NO_FIELD} onValueChange={(selected) => onChange(selected === NO_FIELD ? null : selected)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FIELD}>{emptyLabel}</SelectItem>
        {LEAD_FIELD_OPTIONS.map((option) => (
          <SelectItem key={option.key} value={option.key}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Prazo para o cliente responder (spec 0139, D-13). Padrão: sem prazo — o fluxo fica esperando até a resposta chegar.
 * Com prazo, o bloco ganha a saída "Sem resposta".
 */
export function ReplyDeadlineField({ value, onChange }: { value: unknown; onChange: (minutes: number) => void }) {
  const deadline = resolveReplyDeadline(value);
  return (
    <Field label="Prazo para responder" hint={deadline.hasDeadline ? 'Sem resposta no prazo, segue por "Sem resposta".' : "O fluxo espera a resposta do cliente pelo tempo que for preciso."}>
      <div className="flex gap-2">
        <Select value={deadline.hasDeadline ? "LIMIT" : "NONE"} onValueChange={(mode) => onChange(mode === "LIMIT" ? 60 : 0)}>
          <SelectTrigger className="w-full flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Sem prazo</SelectItem>
            <SelectItem value="LIMIT">Com prazo</SelectItem>
          </SelectContent>
        </Select>
        {deadline.hasDeadline && (
          <div className="flex flex-1 items-center gap-2">
            <Input type="number" min={1} value={deadline.timeoutMinutes} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        )}
      </div>
    </Field>
  );
}

function StartForm({ data, onChange }: FormProps) {
  const entry = parseAttendanceEntry(data);
  return (
    <div className="space-y-4">
      <Field label="Como o cliente entra">
        <Select value={entry.mode} onValueChange={(mode) => onChange({ ...data, mode: mode as AttendanceEntryMode })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_ENTRY_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {ATTENDANCE_ENTRY_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {entry.mode === "KEYWORD" && (
        <>
          <Field label="Palavras-chave" hint="Separe por vírgula. Acentos e maiúsculas não importam.">
            <Input
              defaultValue={entry.keywords.join(", ")}
              onBlur={(event) => onChange({ ...data, keywords: event.target.value.split(",").map((keyword) => keyword.trim()).filter(Boolean) })}
              placeholder="cardápio, pedido, horário"
            />
          </Field>
          <Field label="A mensagem precisa">
            <Select value={entry.matchMode} onValueChange={(matchMode) => onChange({ ...data, matchMode })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTAINS">Conter a palavra</SelectItem>
                <SelectItem value="EXACT">Ser exatamente a palavra</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      {entry.mode === "BROADCAST" && (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">O disparo para uma lista de leads chega na próxima fase. Por enquanto, este fluxo só roda se for chamado por outro fluxo.</p>
      )}
    </div>
  );
}

function AskQuestionForm({ data, onChange }: FormProps) {
  const config = parseAskQuestion(data);
  return (
    <div className="space-y-4">
      <Field label="Pergunta">
        <VariableTextarea value={String(data.question ?? "")} onChange={(question) => onChange({ ...data, question })} placeholder="Qual é o seu e-mail?" />
      </Field>
      <Field label="Tipo de resposta">
        <Select value={config.answerType} onValueChange={(answerType) => onChange({ ...data, answerType: answerType as AnswerType })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWER_TYPES.map((answerType) => (
              <SelectItem key={answerType} value={answerType}>
                {ANSWER_TYPE_LABELS[answerType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {config.answerType === "FILE" ? (
        <p className="text-xs text-muted-foreground">Aceita foto ou PDF (figurinha não vale). A variável guarda a foto para o bloco Registrar cupom.</p>
      ) : (
        <Field label="Gravar no campo do lead">
          <LeadFieldSelect value={config.saveToField} onChange={(saveToField) => onChange({ ...data, saveToField })} emptyLabel="Não gravar no lead" />
        </Field>
      )}
      <Field label="Nome da variável (opcional)" hint="Use nos próximos blocos como {{vars.nome}}.">
        <Input value={String(data.variableName ?? "")} onChange={(event) => onChange({ ...data, variableName: event.target.value })} placeholder="email_cliente" />
      </Field>
      <Field label="Mensagem quando a resposta não vale">
        <VariableTextarea rows={2} value={String(data.invalidMessage ?? "")} onChange={(invalidMessage) => onChange({ ...data, invalidMessage })} placeholder={config.invalidMessage} />
      </Field>
      <Field label="Tentativas">
        <Input type="number" min={1} max={5} value={config.maxAttempts} onChange={(event) => onChange({ ...data, maxAttempts: Number(event.target.value) })} />
      </Field>
      <ReplyDeadlineField value={data.replyTimeoutMinutes} onChange={(replyTimeoutMinutes) => onChange({ ...data, replyTimeoutMinutes })} />
    </div>
  );
}

function RandomizerForm({ data, onChange }: FormProps) {
  const paths = parseRandomizerPaths(data);
  const total = paths.reduce((sum, path) => sum + path.percent, 0);
  const setPaths = (nextPaths: RandomizerPath[]) => onChange({ ...data, paths: nextPaths });
  return (
    <div className="space-y-3">
      {paths.map((path, index) => (
        <div key={path.id} className="flex items-center gap-2">
          <Input value={path.label} onChange={(event) => setPaths(paths.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))} />
          <Input
            type="number"
            className="w-20"
            min={0}
            max={100}
            value={path.percent}
            onChange={(event) => setPaths(paths.map((item, itemIndex) => (itemIndex === index ? { ...item, percent: Number(event.target.value) } : item)))}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button variant="ghost" size="icon" disabled={paths.length <= 2} onClick={() => setPaths(paths.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={paths.length >= 5} onClick={() => setPaths([...paths, { id: createId().slice(0, 8), label: `Caminho ${paths.length + 1}`, percent: 0 }])}>
          <PlusIcon className="size-4" /> Caminho
        </Button>
        <span className={total === 100 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>Total: {total}%</span>
      </div>
    </div>
  );
}

function AiAgentForm({ data, onChange }: FormProps) {
  const config = parseAiAgent(data);
  const rawIntents = (Array.isArray(data.intents) ? data.intents : []) as AiAgentIntent[];
  const rawFields = (Array.isArray(data.fields) ? data.fields : []) as AiAgentField[];
  const setIntents = (intents: AiAgentIntent[]) => onChange({ ...data, intents });
  const setFields = (fields: AiAgentField[]) => onChange({ ...data, fields });
  return (
    <Tabs defaultValue="step" className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="step">Etapa</TabsTrigger>
        <TabsTrigger value="assistant">Assistente</TabsTrigger>
        <TabsTrigger value="capabilities">Pode fazer</TabsTrigger>
      </TabsList>
      <TabsContent value="assistant">
        <AiAgentAssistantSection data={data} onChange={onChange} />
      </TabsContent>
      <TabsContent value="capabilities">
        <AiAgentCapabilitiesSection data={data} onChange={onChange} />
      </TabsContent>
      <TabsContent value="step" className="space-y-4">
      <Field label="Instruções desta etapa" hint="O que a IA faz nesta etapa. Vale por cima do prompt da aba Assistente.">
        <VariableTextarea rows={4} value={String(data.instructions ?? "")} onChange={(instructions) => onChange({ ...data, instructions })} placeholder="Você ajuda o cliente a escolher o plano certo..." />
      </Field>
      <Field label="Objetivo" hint='Quando cumprido, o lead sai por "Objetivo cumprido".'>
        <VariableTextarea rows={2} value={String(data.goal ?? "")} onChange={(goal) => onChange({ ...data, goal })} placeholder="Descobrir o bairro e o interesse do cliente" />
      </Field>

      <div className="space-y-2">
        <Label>Saídas por intenção (opcional)</Label>
        {rawIntents.map((intent, index) => (
          <div key={intent.id} className="space-y-1 rounded-md border p-2">
            <div className="flex gap-2">
              <Input value={intent.label} placeholder="Quer comprar" onChange={(event) => setIntents(rawIntents.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))} />
              <Button variant="ghost" size="icon" onClick={() => setIntents(rawIntents.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2Icon className="size-4" />
              </Button>
            </div>
            <Input value={intent.description} placeholder="Quando o cliente pergunta preço ou forma de pagamento" onChange={(event) => setIntents(rawIntents.map((item, itemIndex) => (itemIndex === index ? { ...item, description: event.target.value } : item)))} />
          </div>
        ))}
        <Button variant="outline" size="sm" disabled={rawIntents.length >= 5} onClick={() => setIntents([...rawIntents, { id: createId().slice(0, 8), label: "", description: "" }])}>
          <PlusIcon className="size-4" /> Intenção
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Dados que a IA grava</Label>
        {rawFields.map((field, index) => (
          <div key={index} className="space-y-1 rounded-md border p-2">
            <div className="flex gap-2">
              <LeadFieldSelect value={field.leadField} emptyLabel="Só variável do fluxo" onChange={(leadField) => setFields(rawFields.map((item, itemIndex) => (itemIndex === index ? { ...item, leadField: leadField as AiAgentField["leadField"] } : item)))} />
              <Button variant="ghost" size="icon" onClick={() => setFields(rawFields.filter((_, itemIndex) => itemIndex !== index))}>
                <Trash2Icon className="size-4" />
              </Button>
            </div>
            <Input value={field.variableName} placeholder="nome da variável (ex.: bairro)" onChange={(event) => setFields(rawFields.map((item, itemIndex) => (itemIndex === index ? { ...item, variableName: event.target.value } : item)))} />
            <Input value={field.description} placeholder="O que é (ex.: bairro onde o cliente mora)" onChange={(event) => setFields(rawFields.map((item, itemIndex) => (itemIndex === index ? { ...item, description: event.target.value } : item)))} />
          </div>
        ))}
        <Button variant="outline" size="sm" disabled={rawFields.length >= 10} onClick={() => setFields([...rawFields, { leadField: null, variableName: "", description: "" }])}>
          <PlusIcon className="size-4" /> Dado
        </Button>
      </div>

      <Field label="Máximo de respostas">
        <Input type="number" min={1} max={50} value={config.maxReplies} onChange={(event) => onChange({ ...data, maxReplies: Number(event.target.value) })} />
      </Field>
      <ReplyDeadlineField value={data.replyTimeoutMinutes} onChange={(replyTimeoutMinutes) => onChange({ ...data, replyTimeoutMinutes })} />
      <p className="text-xs text-muted-foreground">
        {config.assistant ? "Usa o modelo e a chave da IA do funil do número; o resto vem deste bloco." : "Usa a IA do funil do número: nome, prompt, modelo e o que ela pode fazer."} Cada resposta cobra Stars como a IA de sempre.
      </p>
      </TabsContent>
    </Tabs>
  );
}

export function AttendanceNodeForm({ nodeType, data, onChange }: { nodeType: string } & FormProps) {
  switch (nodeType) {
    case "ATTENDANCE_START":
      return <StartForm data={data} onChange={onChange} />;
    case "ASK_QUESTION":
      return <AskQuestionForm data={data} onChange={onChange} />;
    case "RANDOMIZER":
      return <RandomizerForm data={data} onChange={onChange} />;
    case "AI_AGENT":
      return <AiAgentForm data={data} onChange={onChange} />;
    case "DISTRIBUTE":
      return <p className="text-sm text-muted-foreground">Usa o rodízio de atendentes do número em que o lead está (Configurações do funil → Rodízio): escolhe quem recebeu lead há mais tempo e ainda tem espaço. Sem ninguém disponível, segue por &quot;Sem atendente&quot;.</p>;
    default:
      return null;
  }
}
