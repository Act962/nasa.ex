"use client";

import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRecordNotices, useSaveRecordNotice } from "@/features/form-records/hooks/use-record-notices";

// Avisos das fichas em "O que o ASTRO te manda no WhatsApp" (spec 0081, parte C).

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const DAYS_BEFORE_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 30];

function formatPhone(phoneE164: string): string {
  const match = phoneE164.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `+55 ${match[1]} ${match[2]}-${match[3]}` : `+${phoneE164}`;
}

export function RecordNoticePreferences() {
  const { data: notices } = useRecordNotices();
  const saveNotice = useSaveRecordNotice();
  if (!notices) return null;

  const hasPhone = Boolean(notices.boundPhone);
  const isBusy = saveNotice.isPending;
  const onError = (error: Error) => toast.error(error.message || "Não foi possível salvar o aviso.");

  return (
    <section className="rounded-[18px] border bg-card p-4" aria-label="Avisos das fichas">
      <div className="flex items-start gap-2.5">
        <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h4 className="text-sm font-medium">Fichas</h4>
          <p className="text-xs text-muted-foreground">
            {hasPhone
              ? `Vale para o seu número: ${formatPhone(notices.boundPhone!)}`
              : "Seu número não está liberado no ASTRO desta empresa. Peça ao administrador para adicioná-lo acima; sem isso os avisos não saem."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="text-sm">Fichas previstas do dia</p>
          <p className="text-xs text-muted-foreground">A lista do dia e as vencidas, na hora que você escolher. Sem nada previsto, não envia.</p>
          {notices.daily.lastError && <p className="mt-1 text-xs text-destructive">Último envio falhou: {notices.daily.lastError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={String(notices.daily.hour)}
            disabled={!hasPhone || isBusy}
            onValueChange={(value) => saveNotice.mutate({ notice: "daily", isOn: notices.daily.isOn, hour: Number(value) }, { onError })}
          >
            <SelectTrigger className="w-[96px]" aria-label="Hora do resumo do dia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour} value={String(hour)}>
                  {String(hour).padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Switch
            checked={notices.daily.isOn}
            disabled={!hasPhone || isBusy}
            aria-label="Fichas previstas do dia"
            onCheckedChange={(isOn) => saveNotice.mutate({ notice: "daily", isOn, hour: notices.daily.hour }, { onError })}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="text-sm">Avisar antes do prazo</p>
          <p className="text-xs text-muted-foreground">Uma vez por dia, a lista das fichas que vencem dali a alguns dias.</p>
          {notices.dueSoon.lastError && <p className="mt-1 text-xs text-destructive">Último envio falhou: {notices.dueSoon.lastError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={String(notices.dueSoon.daysBefore)}
            disabled={!hasPhone || isBusy}
            onValueChange={(value) => saveNotice.mutate({ notice: "dueSoon", isOn: notices.dueSoon.isOn, daysBefore: Number(value) }, { onError })}
          >
            <SelectTrigger className="w-[96px]" aria-label="Dias antes do prazo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_BEFORE_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} {days === 1 ? "dia" : "dias"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Switch
            checked={notices.dueSoon.isOn}
            disabled={!hasPhone || isBusy}
            aria-label="Avisar antes do prazo"
            onCheckedChange={(isOn) => saveNotice.mutate({ notice: "dueSoon", isOn, daysBefore: notices.dueSoon.daysBefore }, { onError })}
          />
        </div>
      </div>
    </section>
  );
}
