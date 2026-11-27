"use client";

// Painel à esquerda com a configuração do bloco selecionado no editor do FlowAstro (spec 0139).
import { createId } from "@paralleldrive/cuid2";
import { CopyIcon, Trash2Icon, XIcon } from "lucide-react";
import { Uploader } from "@/components/file-uploader/uploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTags } from "@/features/tags/hooks/use-tags";
import { OFFICIAL_MENU_LIMITS } from "@/features/workflows/lib/button-reply-flow";
import { cn } from "@/lib/utils";
import { blockOf } from "../../lib/block-catalog";
import {
  HEADER_TYPES,
  INTERACTIVE_TEXT_LIMITS,
  LINK_BUTTON_TYPE,
  linkButtonUrlProblem,
  type HeaderType,
} from "../../lib/interactive-message";
import { parseColumnMove } from "../../lib/nodes";
import { AttendanceNodeForm, ReplyDeadlineField } from "../attendance-node-forms";
import { FlowVariablesContext, VariableTextarea } from "./variable-textarea";
import { PromoEnrollForm, PromoLookupForm, PromoReceiptForm } from "./promo-forms";
import { ConditionPanel } from "./condition-panel";
import { BLOCK_ICONS, TONE_CLASSES } from "./flow-block-node";
import { TagChips } from "./tag-chips";

type NodeData = Record<string, unknown>;
type FormProps = { data: NodeData; onChange: (data: NodeData) => void };

export interface FlowNumber {
  trackingId: string;
  name: string;
  columns: { id: string; name: string }[];
}

const NO_VALUE = "__none__";

function asFields(value: unknown): NodeData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as NodeData) : {};
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {title && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{title}</p>}
      {children}
    </div>
  );
}

// ─── Enviar mensagem ─────────────────────────────────────────

interface MenuButton {
  id: string;
  text: string;
  /** Só aparece no formato lista (spec 0143). */
  description?: string;
}

const HEADER_LABELS: Record<HeaderType, string> = {
  none: "Sem cabeçalho",
  text: "Título",
  image: "Imagem",
  video: "Vídeo",
  document: "Documento",
};

/** Cabeçalho da mensagem com botões ou botão de link (spec 0143). A lista só aceita título. */
function HeaderField({ value, allowMedia, onChange }: { value: NodeData; allowMedia: boolean; onChange: (header: NodeData | null) => void }) {
  const type: HeaderType = (HEADER_TYPES as readonly string[]).includes(String(value.type)) ? (value.type as HeaderType) : "none";
  const options = allowMedia ? HEADER_TYPES : (["none", "text"] as const);
  const mediaUrl = String(value.mediaUrl ?? "");
  return (
    <Section title="Cabeçalho">
      <Select value={type} onValueChange={(nextType) => onChange(nextType === "none" ? null : { type: nextType })}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {HEADER_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {type === "text" && (
        <Input
          value={String(value.text ?? "")}
          maxLength={INTERACTIVE_TEXT_LIMITS.headerText}
          onChange={(event) => onChange({ type: "text", text: event.target.value })}
          placeholder="Título em negrito no topo"
        />
      )}
      {(type === "image" || type === "video" || type === "document") && (
        <Uploader
          key={`${type}-${mediaUrl}`}
          value={mediaUrl}
          fileTypeAccepted={type === "image" ? "image" : type === "video" ? "video" : "outros"}
          onConfirm={(nextMediaUrl: string, name?: string) => onChange({ type, mediaUrl: nextMediaUrl, fileName: name ?? "" })}
        />
      )}
      {!allowMedia && <p className="text-[11px] text-muted-foreground">Na lista, o WhatsApp só aceita título no cabeçalho.</p>}
    </Section>
  );
}

/**
 * Mensagem no estilo do BotConversa (spec 0139): texto com botões opcionais. Com botões o dado vira um menu que espera
 * o clique (`BUTTONS` + `waitForReply`), e cada botão ganha a própria saída no cartão; sem botões, é texto comum.
 */
function MessageForm({ data, onChange }: FormProps) {
  const action = asFields(data.action);
  const payload = asFields(action.payload);
  const kind = payload.type === "IMAGE" || payload.type === "DOCUMENT" || payload.type === "AUDIO" || payload.type === "VIDEO" ? String(payload.type) : "TEXT";
  const text = String(payload.message ?? payload.bodyText ?? "");
  const buttons = (kind === "TEXT" && payload.type === "BUTTONS" && Array.isArray(payload.buttons) ? payload.buttons : []) as MenuButton[];
  const isLink = kind === "TEXT" && payload.type === LINK_BUTTON_TYPE;
  const isList = !isLink && payload.menuFormat === "LIST";
  const isInteractive = isLink || buttons.length > 0;
  const header = asFields(payload.header);
  const isMediaHeader = header.type === "image" || header.type === "video" || header.type === "document";
  const linkUrl = String(payload.ctaUrl ?? "");
  const linkProblem = linkUrl.trim() ? linkButtonUrlProblem(linkUrl) : null;
  const maxOptions = isList ? OFFICIAL_MENU_LIMITS.maxListRows : OFFICIAL_MENU_LIMITS.maxButtons;
  const titleLimit = isList ? OFFICIAL_MENU_LIMITS.listRowTitleChars : OFFICIAL_MENU_LIMITS.buttonTitleChars;

  const writeText = (nextText: string, nextButtons: MenuButton[], changes: NodeData = {}) => {
    const nextPayload: NodeData =
      nextButtons.length > 0
        ? {
            ...payload,
            ...changes,
            type: "BUTTONS",
            mode: "inline",
            waitForReply: true,
            message: nextText,
            bodyText: nextText,
            buttons: nextButtons,
            menuFormat: changes.menuFormat ?? payload.menuFormat ?? "BUTTON",
          }
        : { ...payload, ...changes, type: "TEXT", message: nextText, bodyText: nextText, buttons: [] };
    onChange({ ...data, action: { ...action, payload: nextPayload } });
  };
  const setMedia = (changes: NodeData) => onChange({ ...data, action: { ...action, payload: { ...payload, ...changes } } });
  const switchToLink = () => {
    if (buttons.length > 0 && !window.confirm("Os botões montados serão descartados. Continuar?")) return;
    setMedia({ type: LINK_BUTTON_TYPE, message: text, bodyText: text, buttons: [], menuFormat: "BUTTON", waitForReply: false });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1">
        {[
          ["TEXT", "Texto"],
          ["IMAGE", "Imagem"],
          ["VIDEO", "Vídeo"],
          ["AUDIO", "Áudio"],
          ["DOCUMENT", "Arquivo"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => (value === "TEXT" ? writeText(text, []) : setMedia({ type: value }))}
            className={cn("rounded-md py-1.5 text-xs font-medium", kind === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "TEXT" && isInteractive && (
        <HeaderField value={header} allowMedia={!isList} onChange={(nextHeader) => setMedia({ header: nextHeader })} />
      )}

      {kind === "TEXT" && (
        <Section>
          <VariableTextarea
            rows={5}
            value={text}
            onChange={(nextText) => (isLink ? setMedia({ message: nextText, bodyText: nextText }) : writeText(nextText, buttons))}
            placeholder="Insira o seu texto"
            maxLength={1024}
          />
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {[
              [false, "Botões de resposta"],
              [true, "Botão de link"],
            ].map(([isLinkOption, label]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => (isLinkOption === isLink ? undefined : isLinkOption ? switchToLink() : writeText(text, []))}
                className={cn("rounded-md py-1.5 text-xs font-medium", isLinkOption === isLink ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>

          {isLink ? (
            <>
              <Field label="Texto do botão">
                <Input
                  value={String(payload.ctaText ?? "")}
                  maxLength={INTERACTIVE_TEXT_LIMITS.linkButtonText}
                  onChange={(event) => setMedia({ ctaText: event.target.value })}
                  placeholder="Ver cardápio"
                />
              </Field>
              <Field label="Endereço" hint={linkProblem ? undefined : "O cliente toca e abre o site. O fluxo segue logo depois do envio."}>
                <Input value={linkUrl} onChange={(event) => setMedia({ ctaUrl: event.target.value })} placeholder="https://site.com/cardapio" />
              </Field>
              {linkProblem && <p className="text-[11px] text-destructive">{linkProblem}</p>}
            </>
          ) : (
            <>
              {buttons.map((button, index) => (
                <div key={button.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={button.text}
                      maxLength={titleLimit}
                      placeholder={isList ? `Item ${index + 1}` : `Botão ${index + 1}`}
                      className="border-emerald-200 text-center dark:border-emerald-500/30"
                      onChange={(event) => writeText(text, buttons.map((item, itemIndex) => (itemIndex === index ? { ...item, text: event.target.value } : item)))}
                    />
                    <Button variant="ghost" size="icon" title="Tirar" onClick={() => writeText(text, buttons.filter((_, itemIndex) => itemIndex !== index))}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                  {isList && (
                    <Input
                      value={button.description ?? ""}
                      maxLength={INTERACTIVE_TEXT_LIMITS.rowDescription}
                      placeholder="Descrição (opcional)"
                      className="h-8 text-xs"
                      onChange={(event) =>
                        writeText(text, buttons.map((item, itemIndex) => (itemIndex === index ? { ...item, description: event.target.value } : item)))
                      }
                    />
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed text-emerald-700 dark:text-emerald-400"
                disabled={buttons.length >= maxOptions}
                onClick={() => writeText(text, [...buttons, { id: createId().slice(0, 10), text: "" }])}
              >
                {isList ? "Adicionar item" : "Adicionar botão"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Cada {isList ? "item" : "botão"} leva o lead para um caminho. Você pode adicionar até {maxOptions}. &quot;Próximo passo&quot; é para quando o cliente
                escreve outra coisa em vez de tocar num botão.
              </p>
              {buttons.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={isList}
                    onCheckedChange={(checked) => {
                      const nextFormat = checked === true ? "LIST" : "BUTTON";
                      const limit = nextFormat === "LIST" ? OFFICIAL_MENU_LIMITS.maxListRows : OFFICIAL_MENU_LIMITS.maxButtons;
                      // A lista só aceita título no cabeçalho (spec 0143, CB-3).
                      writeText(text, buttons.slice(0, limit), { menuFormat: nextFormat, ...(nextFormat === "LIST" && isMediaHeader ? { header: null } : {}) });
                    }}
                  />
                  Enviar como lista (até {OFFICIAL_MENU_LIMITS.maxListRows} opções)
                </label>
              )}
              {isList && (
                <Field label="Texto do botão que abre a lista">
                  <Input value={String(payload.listButton ?? "")} maxLength={20} onChange={(event) => setMedia({ listButton: event.target.value })} placeholder="Ver opções" />
                </Field>
              )}
            </>
          )}

          {isInteractive && (
            <Field label="Rodapé">
              <Input
                value={String(payload.footerText ?? "")}
                maxLength={INTERACTIVE_TEXT_LIMITS.footer}
                onChange={(event) => setMedia({ footerText: event.target.value })}
                placeholder="Opcional, em cinza embaixo do texto"
              />
            </Field>
          )}
        </Section>
      )}

      {kind === "TEXT" && buttons.length > 0 && (
        <ReplyDeadlineField value={payload.replyTimeoutMinutes} onChange={(replyTimeoutMinutes) => setMedia({ replyTimeoutMinutes })} />
      )}

      {kind === "IMAGE" && (
        <>
          <Uploader value={String(payload.imageUrl ?? "")} onConfirm={(imageUrl: string) => setMedia({ imageUrl })} />
          <Field label="Legenda">
            <Input value={String(payload.caption ?? "")} onChange={(event) => setMedia({ caption: event.target.value })} placeholder="Opcional" />
          </Field>
        </>
      )}
      {kind === "VIDEO" && (
        <>
          <Uploader
            key={String(payload.videoUrl ?? "")}
            value={String(payload.videoUrl ?? "")}
            fileTypeAccepted="video"
            onConfirm={(videoUrl: string) => setMedia({ videoUrl })}
          />
          <p className="text-[11px] text-muted-foreground">
            MP4 ou 3GP, até 16 MB, em H.264 com som AAC (o que o WhatsApp aceita). Vídeo em alta qualidade do celular pode não abrir no
            Android: se acontecer, exporte de novo em qualidade padrão.
          </p>
          <Field label="Legenda">
            <Input value={String(payload.caption ?? "")} maxLength={1024} onChange={(event) => setMedia({ caption: event.target.value })} placeholder="Opcional" />
          </Field>
        </>
      )}
      {kind === "AUDIO" && (
        <>
          <Uploader
            key={String(payload.audioUrl ?? "")}
            value={String(payload.audioUrl ?? "")}
            fileTypeAccepted="audio"
            onConfirm={(audioUrl: string, name?: string) => setMedia({ audioUrl, fileName: name ?? "" })}
          />
          <p className="text-[11px] text-muted-foreground">
            MP3, M4A, AAC, AMR ou OGG, até 5 MB. Arquivo OGG (Opus) chega como mensagem de voz; os outros, como áudio com player.
          </p>
        </>
      )}
      {kind === "DOCUMENT" && (
        <>
          <Uploader value={String(payload.documentUrl ?? "")} onConfirm={(documentUrl: string) => setMedia({ documentUrl })} fileTypeAccepted="outros" />
          <Field label="Nome do arquivo">
            <Input value={String(payload.fileName ?? "")} onChange={(event) => setMedia({ fileName: event.target.value })} placeholder="cardapio.pdf" />
          </Field>
          <Field label="Legenda">
            <Input value={String(payload.caption ?? "")} onChange={(event) => setMedia({ caption: event.target.value })} placeholder="Opcional" />
          </Field>
        </>
      )}
    </div>
  );
}

// ─── Atraso ──────────────────────────────────────────────────

function DelayForm({ data, onChange }: FormProps) {
  const action = asFields(data.action);
  const unit = ["minutes", "hours", "days"].includes(String(action.type)) ? String(action.type) : "minutes";
  const amount = Number(action[unit] ?? 0);
  return (
    <Field label="Esperar">
      <div className="flex gap-2">
        <Input type="number" min={1} value={amount} onChange={(event) => onChange({ ...data, action: { type: unit, [unit]: Number(event.target.value) } })} />
        <Select value={unit} onValueChange={(nextUnit) => onChange({ ...data, action: { type: nextUnit, [nextUnit]: amount } })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Field>
  );
}

// ─── Conexão de fluxo ────────────────────────────────────────

function CallFlowForm({ data, onChange, flows }: FormProps & { flows: { id: string; name: string }[] }) {
  return (
    <Field label="Continuar no fluxo" hint="O lead segue no fluxo escolhido, a partir do bloco inicial.">
      <Select
        value={String(data.workflowId || NO_VALUE)}
        onValueChange={(workflowId) => onChange({ ...data, workflowId: workflowId === NO_VALUE ? "" : workflowId, workflowName: flows.find((flow) => flow.id === workflowId)?.name ?? "" })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione o fluxo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_VALUE}>Selecione o fluxo</SelectItem>
          {flows.map((flow) => (
            <SelectItem key={flow.id} value={flow.id}>
              {flow.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// ─── Etiqueta ────────────────────────────────────────────────

function TagForm({ data, onChange }: FormProps) {
  const { tags } = useTags();
  const action = asFields(data.action);
  const selectedIds = new Set((Array.isArray(action.tagsIds) ? action.tagsIds : []) as string[]);
  const setAction = (changes: NodeData) => onChange({ ...data, action: { ...action, ...changes } });
  return (
    <div className="space-y-4">
      <Select value={action.type === "REMOVE" ? "REMOVE" : "ADD"} onValueChange={(type) => setAction({ type })}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADD">Adicionar etiquetas</SelectItem>
          <SelectItem value="REMOVE">Tirar etiquetas</SelectItem>
        </SelectContent>
      </Select>
      {selectedIds.size > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Escolhidas ({selectedIds.size})</p>
          <TagChips
            tagIds={[...selectedIds]}
            onRemove={(tagId) => setAction({ tagsIds: [...selectedIds].filter((id) => id !== tagId) })}
          />
        </div>
      )}
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {tags.map((tag) => (
          <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
            <Checkbox
              checked={selectedIds.has(tag.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selectedIds);
                if (checked) next.add(tag.id);
                else next.delete(tag.id);
                setAction({ tagsIds: [...next] });
              }}
            />
            <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color ?? "#94a3b8" }} />
            {tag.name}
          </label>
        ))}
        {tags.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhuma etiqueta cadastrada.</p>}
      </div>
    </div>
  );
}

// ─── Mover coluna / Finalizar ────────────────────────────────

function ColumnForm({ data, onChange, numbers }: FormProps & { numbers: FlowNumber[] }) {
  const { endFlow, columns } = parseColumnMove(data);
  return (
    <div className="space-y-4">
      {endFlow && <p className="text-xs text-muted-foreground">O fluxo do lead termina aqui. A próxima mensagem dele segue as regras de entrada de novo.</p>}
      {numbers.length === 0 && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Escolha os números do fluxo no topo para definir as colunas.</p>}
      {numbers.map((number) => (
        <Field key={number.trackingId} label={`Coluna em ${number.name}`}>
          <Select
            value={columns[number.trackingId] ?? NO_VALUE}
            onValueChange={(statusId) => {
              const nextColumns = { ...columns };
              if (statusId === NO_VALUE) delete nextColumns[number.trackingId];
              else nextColumns[number.trackingId] = statusId;
              onChange({ ...data, endFlow, columns: nextColumns });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_VALUE}>{endFlow ? "Não mover" : "Não mover neste número"}</SelectItem>
              {number.columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ))}
    </div>
  );
}

// ─── Painel ──────────────────────────────────────────────────

export function BlockPanel({
  nodeType,
  data,
  numbers,
  flows,
  variableNames,
  onChange,
  onClose,
  onDelete,
  onDuplicate,
}: {
  nodeType: string;
  data: NodeData;
  numbers: FlowNumber[];
  flows: { id: string; name: string }[];
  variableNames: string[];
  onChange: (data: NodeData) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const block = blockOf(nodeType, data);
  const Icon = block ? BLOCK_ICONS[block.key] : null;
  const isStart = nodeType === "ATTENDANCE_START";
  const renderForm = () => {
    switch (block?.key) {
      case "message":
        return <MessageForm data={data} onChange={onChange} />;
      case "delay":
        return <DelayForm data={data} onChange={onChange} />;
      case "condition":
        return <ConditionPanel data={data} onChange={onChange} variableNames={variableNames} />;
      case "callFlow":
        return <CallFlowForm data={data} onChange={onChange} flows={flows} />;
      case "tag":
        return <TagForm data={data} onChange={onChange} />;
      case "promoEnroll":
        return <PromoEnrollForm data={data} onChange={onChange} />;
      case "promoReceipt":
        return <PromoReceiptForm data={data} onChange={onChange} />;
      case "promoLookup":
        return <PromoLookupForm data={data} onChange={onChange} />;
      case "finish":
      case "moveColumn":
        return <ColumnForm data={data} onChange={onChange} numbers={numbers} />;
      default:
        return <AttendanceNodeForm nodeType={nodeType} data={data} onChange={onChange} />;
    }
  };
  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {Icon && <Icon className={cn("size-5", TONE_CLASSES[block?.tone ?? "slate"].icon)} />}
        <h2 className="flex-1 text-base font-semibold">{block?.label ?? nodeType}</h2>
        {!isStart && (
          <>
            <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicar">
              <CopyIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Apagar">
              <Trash2Icon className="size-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4"><FlowVariablesContext.Provider value={variableNames}>{renderForm()}</FlowVariablesContext.Provider></div>
    </aside>
  );
}

