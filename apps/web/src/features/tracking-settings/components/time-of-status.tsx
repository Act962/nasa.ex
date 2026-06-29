"use client";

import { useEffect, useState } from "react";
import { Timer, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatus, useUpdateStatus } from "@/features/status/hooks/use-status";
import { cn } from "@/lib/utils";

/**
 * Tela "Time de Status" — Configurações > Time de Status.
 *
 * Lista todos os status do tracking e permite o admin/owner setar
 * `slaHours` (tempo limite em horas) por status. O cálculo de `slaDeadline`
 * por lead acontece server-side via `status.update` (recalcula deadline
 * de TODOS os leads ativos do status alterado). No card do kanban, o
 * `SlaTimer` aparece automaticamente sempre que o lead tem `slaDeadline`.
 *
 * Persistência por blur (sai do campo) + Enter — mesmo padrão do resto
 * do app (lead-info, etc.). Não usamos debounce pra evitar saves
 * intermediários enquanto o usuário ainda está digitando.
 */
export function TimeOfStatus({ trackingId }: { trackingId: string }) {
  const { status, isLoadingStatus } = useStatus(trackingId);
  const updateStatus = useUpdateStatus(trackingId);

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Timer className="size-4" />
          <h2 className="text-xl font-semibold">Time de Status</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure quanto tempo (em horas) um lead deve permanecer em cada
          etapa. Quando o tempo for ultrapassado, o card mostra um indicador
          de atraso.
        </p>
      </div>

      {/* Lista de status com input de horas */}
      <div className="flex flex-col gap-2">
        {isLoadingStatus && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}

        {!isLoadingStatus && status.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum status criado neste tracking ainda. Crie status primeiro no
            kanban pra configurar tempos aqui.
          </div>
        )}

        {!isLoadingStatus &&
          status.map((s: any) => (
            <StatusRow
              key={s.id}
              statusId={s.id}
              name={s.name}
              color={s.color}
              initialSlaHours={s.slaHours ?? null}
              isPending={updateStatus.isPending}
              onSave={(slaHours) =>
                updateStatus.mutate({
                  statusId: s.id,
                  slaHours,
                })
              }
            />
          ))}
      </div>
    </div>
  );
}

/**
 * Linha individual de status. Mantém estado local do input pra não
 * piscar enquanto a mutation roda; sincroniza com `initialSlaHours`
 * quando o servidor responde via `useEffect`.
 */
function StatusRow({
  statusId,
  name,
  color,
  initialSlaHours,
  isPending,
  onSave,
}: {
  statusId: string;
  name: string;
  color: string | null;
  initialSlaHours: number | null;
  isPending: boolean;
  onSave: (slaHours: number | null) => void;
}) {
  const [value, setValue] = useState<string>(
    initialSlaHours != null ? String(initialSlaHours) : "",
  );

  // Sincroniza com o valor do servidor quando muda (após save remoto ou
  // refetch). Sem isso, o input ficaria preso no valor antigo se o
  // servidor normalizar (ex: clamp 0 → null).
  useEffect(() => {
    setValue(initialSlaHours != null ? String(initialSlaHours) : "");
  }, [initialSlaHours]);

  function commit() {
    const trimmed = value.trim();
    // Vazio → null (limpa o SLA). Schema aceita null pra remover.
    if (trimmed.length === 0) {
      if (initialSlaHours !== null) {
        onSave(null);
      }
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      // Inválido → reverte pro valor do servidor sem fazer save.
      setValue(initialSlaHours != null ? String(initialSlaHours) : "");
      return;
    }
    // Clamp no max do schema (8760 = 1 ano) — alinha com o zod no server.
    const clamped = Math.min(parsed, 8760);
    if (clamped !== initialSlaHours) {
      onSave(clamped);
      if (clamped !== parsed) {
        setValue(String(clamped));
      }
    }
  }

  function handleClear() {
    setValue("");
    if (initialSlaHours !== null) {
      onSave(null);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3",
        isPending && "opacity-60",
      )}
    >
      {/* Pill colorida com nome do status — mesmo visual do header da
          coluna do kanban. `getContrastColor` poderia ser usado pra
          texto, mas aqui mantemos sempre fundo claro com cor da pill
          como borda esquerda pra reduzir contraste forte. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: color ?? "#1447e6" }}
          aria-hidden
        />
        <span className="truncate text-sm font-medium">{name}</span>
      </div>

      {/* Input de horas + label */}
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          min={1}
          max={8760}
          inputMode="numeric"
          placeholder="—"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          disabled={isPending}
          className="h-9 w-24 text-right tabular-nums"
        />
        <span className="w-12 text-xs text-muted-foreground">horas</span>

        {/* Botão de limpar — só aparece quando há valor configurado. */}
        {initialSlaHours !== null ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={isPending}
            onClick={handleClear}
            title="Limpar tempo (remove o SLA deste status)"
          >
            <X className="size-4" />
          </Button>
        ) : (
          // Placeholder com mesma largura pra alinhar as linhas — sem ele,
          // linhas com slaHours preenchido ficariam com largura diferente.
          <span aria-hidden className="size-9" />
        )}
      </div>
    </div>
  );
}
