"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useBotConfig,
  useUpsertBotConfig,
} from "@/features/astro-bot/hooks/use-astro-bot";
import { AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PROVIDER_LABEL: Record<string, string> = {
  UAZAPI: "Uazapi",
  META_CLOUD: "WhatsApp Cloud (Meta)",
};

/**
 * Configuração do Astro pelo WhatsApp na org. O Astro responde pelo número da
 * própria tracking (provider ativo dela) — aqui o admin escolhe QUAIS trackings
 * ficam habilitadas, os limites e a ativação. Apenas owners/admins.
 */
export function BotConfigSection() {
  const { config, availableTrackings, isLoading } = useBotConfig();
  const upsert = useUpsertBotConfig();

  const [enabledTrackingIds, setEnabledTrackingIds] = useState<string[]>([]);
  const [maxCmdsPerHour, setMaxCmdsPerHour] = useState(30);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!config) return;
    setEnabledTrackingIds(config.enabledTrackingIds ?? []);
    setMaxCmdsPerHour(config.maxCmdsPerHour);
    setQuietHoursStart(
      config.quietHoursStart != null ? String(config.quietHoursStart) : "",
    );
    setQuietHoursEnd(
      config.quietHoursEnd != null ? String(config.quietHoursEnd) : "",
    );
    setIsActive(config.isActive);
  }, [config]);

  const toggleTracking = (trackingId: string) => {
    setEnabledTrackingIds((prev) =>
      prev.includes(trackingId)
        ? prev.filter((id) => id !== trackingId)
        : [...prev, trackingId],
    );
  };

  const handleSave = () => {
    upsert.mutate(
      {
        enabledTrackingIds,
        maxCmdsPerHour,
        quietHoursStart: quietHoursStart === "" ? null : Number(quietHoursStart),
        quietHoursEnd: quietHoursEnd === "" ? null : Number(quietHoursEnd),
        isActive,
      },
      {
        onSuccess: () => toast.success("Configuração salva"),
        onError: (e) => toast.error(e.message || "Erro ao salvar"),
      },
    );
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <Loader2 className="size-5 animate-spin" />
      </Card>
    );
  }

  const bindingCount =
    (config as { _count?: { bindings?: number } } | null)?._count?.bindings ??
    0;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <MessageCircle className="size-5 text-violet-500" />
        <div>
          <h3 className="font-semibold">Trackings habilitadas</h3>
          <p className="text-sm text-muted-foreground">
            O Astro responde pelo número da própria tracking, usando o provedor
            ativo dela. Selecione quais trackings devem responder.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {availableTrackings.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma tracking encontrada. Conecte um número WhatsApp a uma
            tracking em Integrações primeiro.
          </div>
        ) : (
          <div className="space-y-2">
            {availableTrackings.map((tracking) => {
              const instance = tracking.whatsappInstance;
              const checked = enabledTrackingIds.includes(tracking.id);
              return (
                <label
                  key={tracking.id}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTracking(tracking.id)}
                    disabled={!instance}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{tracking.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {instance
                        ? `${PROVIDER_LABEL[instance.provider] ?? instance.provider}${
                            instance.phoneNumber
                              ? ` · +${instance.phoneNumber}`
                              : ""
                          }${
                            instance.status && instance.status !== "CONNECTED"
                              ? ` · ${instance.status}`
                              : ""
                          }`
                        : "Sem número WhatsApp conectado"}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Máx. comandos por hora (por número)</Label>
        <Input
          type="number"
          min={1}
          max={500}
          value={maxCmdsPerHour}
          onChange={(e) => setMaxCmdsPerHour(Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label>Horário silencioso (opcional) — fuso América/SP</Label>
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            min={0}
            max={23}
            placeholder="Início (0-23)"
            value={quietHoursStart}
            onChange={(e) => setQuietHoursStart(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            max={23}
            placeholder="Fim (0-23)"
            value={quietHoursEnd}
            onChange={(e) => setQuietHoursEnd(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Durante esse intervalo, comandos recebem aviso amigável e não são
          processados.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Ativar Astro pelo WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            {bindingCount} número(s) na allow-list
          </p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>

      {isActive && enabledTrackingIds.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          <AlertTriangle className="size-4 text-yellow-600 shrink-0 mt-0.5" />
          <p>
            Você marcou como ativo, mas nenhuma tracking foi selecionada. O
            Astro só responde nas trackings habilitadas.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Salvar configuração"
          )}
        </Button>
      </div>
    </Card>
  );
}
