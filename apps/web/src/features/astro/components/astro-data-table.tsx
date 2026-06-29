"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildEntityHref,
  type AstroTableColumn,
  type AstroTablePayload,
  type AstroTableRow,
} from "@/features/astro/lib/astro-table";
import { ExternalLinkIcon } from "lucide-react";

/**
 * Tabela renderizada dentro das mensagens do Astro quando uma tool
 * retorna `{ kind: "astro_table", ... }`.
 *
 * Cada linha vira <Link> pra rota canônica da entidade — clicar abre
 * o card/detalhe. Construção da URL fica em `buildEntityHref` (lib).
 *
 * Visual: clean dark table com hover destacando a linha; primeira coluna
 * em negrito (foco); colunas tipadas (currency, date, badge) com format
 * humanizado.
 */
export function AstroDataTable({ payload }: { payload: AstroTablePayload }) {
  if (payload.rows.length === 0) {
    return (
      <div className="w-full rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
        {payload.caption ?? "Nenhum resultado encontrado."}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/40">
      {payload.caption && (
        <div className="border-b border-zinc-800/80 px-3 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
          {payload.caption}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-900/60 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              {payload.columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th aria-hidden className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {payload.rows.map((row) => (
              <TableRow
                key={row.id}
                row={row}
                columns={payload.columns}
                href={buildEntityHref(payload.entityType, row)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {payload.totalCount !== undefined &&
        payload.totalCount > payload.rows.length && (
          <div className="border-t border-zinc-800/80 px-3 py-2 text-[10px] text-zinc-500">
            Mostrando {payload.rows.length} de {payload.totalCount} —
            refine os filtros pra ver outros.
          </div>
        )}
    </div>
  );
}

function TableRow({
  row,
  columns,
  href,
}: {
  row: AstroTableRow;
  columns: AstroTableColumn[];
  href: string | null;
}) {
  const cells = columns.map((c, i) => (
    <td
      key={c.key}
      className={cn(
        "px-3 py-2 align-middle",
        i === 0 ? "font-medium text-zinc-200" : "text-zinc-400",
      )}
    >
      {formatCell(row[c.key], c.type)}
    </td>
  ));

  // Linha clicável só se há rota definida — algumas entidades (proposta
  // hoje) só linkam pro app raiz; ainda assim faz sentido linkar.
  if (href) {
    return (
      <tr className="group border-b border-zinc-800/40 transition-colors last:border-b-0 hover:bg-zinc-800/40">
        {/* Wrappear `tr` em `Link` quebra HTML — colocamos Link na primeira
            célula com `colSpan` invisível? Não — usamos um onClick handler
            via Link wrapping cada célula pra preservar acessibilidade. */}
        {columns.map((c, i) => (
          <td
            key={c.key}
            className={cn(
              "p-0 align-middle",
              i === 0 ? "font-medium text-zinc-200" : "text-zinc-400",
            )}
          >
            <Link
              href={href}
              className="block px-3 py-2 hover:text-white focus:outline-none focus-visible:bg-zinc-800/60"
            >
              {formatCell(row[c.key], c.type)}
            </Link>
          </td>
        ))}
        <td className="px-2 align-middle text-zinc-600 group-hover:text-zinc-300">
          <Link href={href} aria-label="Abrir detalhes" className="block px-1 py-2">
            <ExternalLinkIcon className="size-3" />
          </Link>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/40 last:border-b-0">
      {cells}
      <td aria-hidden />
    </tr>
  );
}

function formatCell(
  value: string | number | boolean | null | undefined,
  type: AstroTableColumn["type"],
): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";

  switch (type) {
    case "currency": {
      // Espera centavos (number). Converte pra R$ formatado.
      const cents = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(cents)) return "—";
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return "—";
      return n.toLocaleString("pt-BR");
    }
    case "date": {
      const d = typeof value === "string" ? new Date(value) : null;
      if (!d || Number.isNaN(d.getTime())) return "—";
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    }
    case "badge": {
      const text = String(value);
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
            badgeTone(text),
          )}
        >
          {humanizeBadge(text)}
        </span>
      );
    }
    default:
      return String(value);
  }
}

/** Mapeia status comuns pra tons de cor. */
function badgeTone(value: string): string {
  const upper = value.toUpperCase();
  // Estados positivos
  if (
    [
      "WON",
      "PAGA",
      "DONE",
      "CONFIRMED",
      "PAID",
      "CONCLUÍDA",
      "PUBLISHED",
    ].includes(upper)
  ) {
    return "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30";
  }
  // Estados de alerta / atraso
  if (
    [
      "URGENT",
      "OVERDUE",
      "EXPIRADA",
      "ATRASADA",
      "NO_SHOW",
      "LOST",
      "CANCELADA",
      "CANCELLED",
    ].includes(upper)
  ) {
    return "bg-red-500/10 text-red-300 ring-red-500/30";
  }
  // Estados intermediários
  if (
    [
      "HIGH",
      "VISUALIZADA",
      "ENVIADA",
      "PENDING",
      "PARTIAL",
      "ABERTA",
    ].includes(upper)
  ) {
    return "bg-amber-500/10 text-amber-300 ring-amber-500/30";
  }
  if (["ACTIVE", "MEDIUM"].includes(upper)) {
    return "bg-blue-500/10 text-blue-300 ring-blue-500/30";
  }
  return "bg-zinc-700/40 text-zinc-300 ring-zinc-600/40";
}

/** Converte enums "screaming snake" em texto humano. */
function humanizeBadge(value: string): string {
  const map: Record<string, string> = {
    WON: "Ganho",
    LOST: "Perdido",
    ACTIVE: "Ativo",
    DONE: "Realizado",
    PENDING: "Pendente",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    NO_SHOW: "No-show",
    RASCUNHO: "Rascunho",
    ENVIADA: "Enviada",
    VISUALIZADA: "Visualizada",
    PAGA: "Paga",
    EXPIRADA: "Expirada",
    CANCELADA: "Cancelada",
    HIGH: "Alta",
    URGENT: "Urgente",
    MEDIUM: "Média",
    LOW: "Baixa",
    NONE: "—",
  };
  return map[value.toUpperCase()] ?? value;
}
