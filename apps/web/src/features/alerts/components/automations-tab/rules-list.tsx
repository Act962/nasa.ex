"use client";

import {
  AlertTriangle,
  Bell,
  Building2,
  Edit3,
  Power,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CatalogEvent {
  key: string;
  label: string;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  eventType: string;
  severity: string;
  isActive: boolean;
  isGlobal: boolean;
  lastDispatchAt: string | null;
}

interface RulesListProps {
  rules: Rule[];
  loading?: boolean;
  catalogEvents: CatalogEvent[];
  onToggle: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}

/**
 * Lista de AlertRules existentes filtrada pelo app ativo.
 * Cada linha mostra: nome, evento humanizado, severity badge, scope badge,
 * último disparo, e ações (toggle on/off, editar, excluir).
 */
export function RulesList({
  rules,
  loading,
  catalogEvents,
  onToggle,
  onEdit,
  onDelete,
}: RulesListProps) {
  if (loading) {
    return (
      <div className="text-xs text-zinc-500">Carregando regras…</div>
    );
  }
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-6 text-center text-xs text-zinc-500">
        Nenhuma regra criada pra esse app ainda. Clica num card acima pra
        começar.
      </div>
    );
  }

  const eventMap = new Map(catalogEvents.map((e) => [e.key, e.label]));

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        Suas regras
      </div>
      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 divide-y divide-zinc-800/60">
        {rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            eventLabel={eventMap.get(rule.eventType) ?? rule.eventType}
            onToggle={() => onToggle(rule)}
            onEdit={() => onEdit(rule)}
            onDelete={() => onDelete(rule)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  eventLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: Rule;
  eventLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const SeverityIcon =
    rule.severity === "critical"
      ? AlertTriangle
      : rule.severity === "warning"
        ? Zap
        : Bell;
  const sevColor =
    rule.severity === "critical"
      ? "text-red-400"
      : rule.severity === "warning"
        ? "text-amber-400"
        : "text-blue-400";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5",
        !rule.isActive && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "shrink-0 p-1.5 rounded-md transition-colors",
          rule.isActive
            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700",
        )}
        aria-label={rule.isActive ? "Desativar" : "Ativar"}
        title={rule.isActive ? "Desativar regra" : "Ativar regra"}
      >
        <Power className="w-3.5 h-3.5" />
      </button>

      <SeverityIcon className={cn("w-3.5 h-3.5 shrink-0", sevColor)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {rule.name}
          </span>
          {rule.isGlobal ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
              <Building2 className="w-2.5 h-2.5" />
              Global
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
              <User className="w-2.5 h-2.5" />
              Org
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
          {eventLabel}
          {rule.lastDispatchAt && (
            <>
              {" · "}
              <span className="text-zinc-600">
                últ. disparo{" "}
                {formatDistanceToNow(new Date(rule.lastDispatchAt), {
                  locale: ptBR,
                  addSuffix: true,
                })}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          aria-label="Editar"
          title="Editar"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          aria-label="Excluir"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
