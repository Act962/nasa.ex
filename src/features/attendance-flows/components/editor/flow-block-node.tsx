"use client";

// Cartão de um bloco no editor do FlowAstro: sóbrio, com o conteúdo à mostra e uma saída por linha (spec 0139).
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  BotIcon,
  ChevronRightIcon,
  CircleStopIcon,
  ClipboardPenIcon,
  ColumnsIcon,
  FilterIcon,
  GitForkIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
  RocketIcon,
  ShuffleIcon,
  TagIcon,
  TicketIcon,
  TimerIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blockOf, blockOutputs, type BlockKey, type BlockTone } from "../../lib/block-catalog";
import { blockPreview } from "../../lib/block-preview";
import { parseCondition } from "../../lib/conditions";
import { useDescribeConditionRule } from "../../hooks/use-condition-labels";
import { TagChips } from "./tag-chips";

const CARD_MAX_TAGS = 3;

function tagIdsOf(data: FlowBlockData): string[] {
  const action = data.action && typeof data.action === "object" ? (data.action as Record<string, unknown>) : {};
  return Array.isArray(action.tagsIds) ? action.tagsIds.map(String) : [];
}

/** Etiquetas escolhidas no cartão: poucas à mostra e o resto em "+N", para o cartão não crescer. */
function TagPreview({ data }: { data: FlowBlockData }) {
  const action = data.action && typeof data.action === "object" ? (data.action as Record<string, unknown>) : {};
  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{action.type === "REMOVE" ? "Tirar" : "Adicionar"}</p>
      <TagChips tagIds={tagIdsOf(data)} maxVisible={CARD_MAX_TAGS} />
    </>
  );
}

/** Regras da Condição no cartão, como no BotConversa: o campo pequeno em cima, o que é testado embaixo. */
function ConditionRulesPreview({ data }: { data: FlowBlockData }) {
  const describeRule = useDescribeConditionRule();
  const { match, rules } = parseCondition(data);
  if (rules.length === 0) return <p className="rounded-lg bg-background/70 px-2.5 py-2 text-[11px] italic text-muted-foreground dark:bg-background/40">Selecione as condições</p>;
  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Lógica {match === "ALL" ? "E" : "Ou"}</p>
      {rules.map((rule) => {
        const { fieldLabel, operatorLabel, valueLabel } = describeRule(rule);
        return (
          <div key={rule.id} className="rounded-lg bg-background/70 px-2.5 py-1.5 dark:bg-background/40">
            <p className="text-[9px] font-medium text-indigo-700 dark:text-indigo-300">{fieldLabel}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {operatorLabel} {valueLabel}
            </p>
          </div>
        );
      })}
    </>
  );
}

export type FlowBlockData = Record<string, unknown> & { leadsHere?: number };
export type FlowBlockNodeType = Node<FlowBlockData>;

export const BLOCK_ICONS: Record<BlockKey, LucideIcon> = {
  start: RocketIcon,
  message: MessageCircleIcon,
  question: ClipboardPenIcon,
  condition: FilterIcon,
  randomizer: ShuffleIcon,
  delay: TimerIcon,
  callFlow: GitForkIcon,
  aiAgent: BotIcon,
  distribute: UsersIcon,
  tag: TagIcon,
  moveColumn: ColumnsIcon,
  finish: CircleStopIcon,
  promoEnroll: TicketIcon,
  promoReceipt: ReceiptTextIcon,
  promoLookup: TrophyIcon,
};

export const TONE_CLASSES: Record<BlockTone, { icon: string; soft: string; card: string }> = {
  sky: { icon: "text-sky-600 dark:text-sky-400", soft: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", card: "bg-sky-50 border-sky-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-sky-500)_7%)] dark:border-sky-500/20" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", card: "bg-emerald-50 border-emerald-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-emerald-500)_7%)] dark:border-emerald-500/20" },
  indigo: { icon: "text-indigo-600 dark:text-indigo-400", soft: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", card: "bg-indigo-50 border-indigo-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-indigo-500)_7%)] dark:border-indigo-500/20" },
  teal: { icon: "text-teal-600 dark:text-teal-400", soft: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", card: "bg-teal-50 border-teal-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-teal-500)_7%)] dark:border-teal-500/20" },
  amber: { icon: "text-amber-600 dark:text-amber-400", soft: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", card: "bg-amber-50 border-amber-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-amber-500)_7%)] dark:border-amber-500/20" },
  slate: { icon: "text-muted-foreground", soft: "bg-muted text-foreground", card: "bg-[color-mix(in_oklab,var(--card),var(--muted)_40%)] border-border" },
  violet: { icon: "text-violet-600 dark:text-violet-400", soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", card: "bg-violet-50 border-violet-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-violet-500)_7%)] dark:border-violet-500/20" },
  blue: { icon: "text-blue-600 dark:text-blue-400", soft: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", card: "bg-blue-50 border-blue-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-blue-500)_7%)] dark:border-blue-500/20" },
  orange: { icon: "text-orange-600 dark:text-orange-400", soft: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", card: "bg-orange-50 border-orange-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-orange-500)_7%)] dark:border-orange-500/20" },
  rose: { icon: "text-rose-600 dark:text-rose-400", soft: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", card: "bg-rose-50 border-rose-100 dark:bg-[color-mix(in_oklab,var(--card),var(--color-rose-500)_7%)] dark:border-rose-500/20" },
};

// Pontos de ligação dentro do cartão, como no BotConversa: entrada ao lado do título, saída ao lado de cada caminho.
const INLINE_HANDLE = "!relative !inset-auto !flex !size-[18px] !shrink-0 !transform-none !items-center !justify-center !rounded-full";
// Metade dentro, metade fora: 22px = padding do cartão (12) + borda (1) + metade do ponto (9).
const TARGET_HANDLE = cn(INLINE_HANDLE, "!-ml-[22px] !border !border-blue-500 !bg-card");
const SOURCE_HANDLE = cn(INLINE_HANDLE, "!-mr-[22px] !border-0 !bg-blue-500 hover:!bg-blue-600");

function SourceHandle({ id }: { id: string }) {
  return (
    <Handle id={id} type="source" position={Position.Right} className={SOURCE_HANDLE}>
      <ChevronRightIcon className="pointer-events-none size-3 text-white" strokeWidth={3} />
    </Handle>
  );
}

export const FlowBlockNode = memo(({ type, data, selected }: NodeProps<FlowBlockNodeType>) => {
  const nodeType = String(type);
  const block = blockOf(nodeType, data);
  const outputs = blockOutputs(nodeType, data);
  const buttonOutputs = outputs.filter((output) => output.isButton);
  const pathOutputs = outputs.filter((output) => !output.isButton);
  const hasTagPreview = nodeType === "TAG" && tagIdsOf(data).length > 0;
  const preview = hasTagPreview ? [] : blockPreview(nodeType, data);
  const Icon = block ? BLOCK_ICONS[block.key] : MessageCircleIcon;
  const tone = TONE_CLASSES[block?.tone ?? "slate"];
  const isStart = nodeType === "ATTENDANCE_START";
  const leadsHere = typeof data.leadsHere === "number" ? data.leadsHere : 0;
  const hasBody = nodeType === "IF_CONDITION" || hasTagPreview || preview.length > 0 || buttonOutputs.length > 0;

  return (
    <div
      className={cn(
        "w-[260px] space-y-2.5 rounded-2xl border p-3 text-foreground shadow-sm transition-shadow",
        tone.card,
        selected ? "!border-blue-500 ring-2 ring-blue-500/25" : "hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2">
        {!isStart && (
          <Handle id="target-1" type="target" position={Position.Left} className={TARGET_HANDLE}>
            <ChevronRightIcon className="pointer-events-none size-3 text-blue-500" strokeWidth={3} />
          </Handle>
        )}
        <Icon className={cn("size-[18px] shrink-0", tone.icon)} />
        <span className="flex-1 truncate text-[13px] font-semibold">{block?.label ?? nodeType}</span>
        {leadsHere > 0 && (
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" title="Leads parados neste bloco agora">
            {leadsHere}
          </span>
        )}
      </div>
      {hasBody && (
        <div className="space-y-1.5">
          {nodeType === "IF_CONDITION" && <ConditionRulesPreview data={data} />}
          {hasTagPreview && <TagPreview data={data} />}
          {preview.map((line, index) => (
            <p
              key={index}
              className={cn(
                "line-clamp-3 whitespace-pre-line rounded-lg bg-background/70 px-2.5 py-2 text-[11px] leading-snug dark:bg-background/40",
                line.isEmpty ? "italic text-muted-foreground" : "text-foreground/80",
              )}
            >
              {line.text}
            </p>
          ))}
          {/* Botões da mensagem: cada um leva o lead para um caminho, como no BotConversa. */}
          {buttonOutputs.map((output) => (
            <div key={output.handleId} className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-card px-2 py-1.5 text-center text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {output.label}
              </div>
              <SourceHandle id={output.handleId} />
            </div>
          ))}
        </div>
      )}
      {pathOutputs.length > 0 && (
        <div className="space-y-1.5">
          {pathOutputs.map((output) => (
            <div key={output.handleId} className="flex items-center justify-end gap-1.5">
              <span className="truncate text-[11px] text-muted-foreground">{output.label}</span>
              <SourceHandle id={output.handleId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

FlowBlockNode.displayName = "FlowBlockNode";
