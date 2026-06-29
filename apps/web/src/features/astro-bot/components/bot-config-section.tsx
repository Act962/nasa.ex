"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useBotConfig,
  useUpsertBotConfig,
} from "@/features/astro-bot/hooks/use-astro-bot";
import { AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Configuração do canal do Astro Bot WhatsApp na org.
 * Apenas owners/admins devem ver — guarded pela tab no settings.
 */
export function BotConfigSection() {
  const { config, availableInstances, isLoading } = useBotConfig();
  const upsert = useUpsertBotConfig();

  const [provider, setProvider] = useState<"UAZAPI" | "META_CLOUD">("UAZAPI");
  const [uazapiInstanceId, setUazapiInstanceId] = useState<string>("");
  const [maxPhonesPerOrg, setMaxPhonesPerOrg] = useState(3);
  const [maxCmdsPerHour, setMaxCmdsPerHour] = useState(30);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider as "UAZAPI" | "META_CLOUD");
    setUazapiInstanceId(config.uazapiInstanceId ?? "");
    setMaxPhonesPerOrg(config.maxPhonesPerOrg);
    setMaxCmdsPerHour(config.maxCmdsPerHour);
    setQuietHoursStart(
      config.quietHoursStart != null ? String(config.quietHoursStart) : "",
    );
    setQuietHoursEnd(
      config.quietHoursEnd != null ? String(config.quietHoursEnd) : "",
    );
    setIsActive(config.isActive);
  }, [config]);

  const handleSave = () => {
    if (provider === "UAZAPI" && !uazapiInstanceId) {
      toast.error("Selecione a instância WhatsApp dedicada ao bot");
      return;
    }
    upsert.mutate(
      {
        provider,
        uazapiInstanceId: uazapiInstanceId || null,
        maxPhonesPerOrg,
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
          <h3 className="font-semibold">Canal do bot</h3>
          <p className="text-sm text-muted-foreground">
            Configure a instância dedicada que recebe comandos via WhatsApp.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Provedor</Label>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as "UAZAPI" | "META_CLOUD")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UAZAPI">Uazapi (Earth — atual)</SelectItem>
            <SelectItem value="META_CLOUD" disabled>
              Meta Cloud API (em breve)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {provider === "UAZAPI" && (
        <div className="space-y-2">
          <Label>Instância WhatsApp dedicada</Label>
          <Select
            value={uazapiInstanceId}
            onValueChange={setUazapiInstanceId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              {availableInstances.length === 0 ? (
                <SelectItem value="__none" disabled>
                  Nenhuma instância — conecte uma em Integrações
                </SelectItem>
              ) : (
                availableInstances.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.instanceName || i.phoneNumber || i.id}
                    {i.trackingId ? " (em uso por tracking)" : " (livre)"}
                    {i.status !== "connected" ? ` — ${i.status}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Use uma instância exclusiva pro bot — separada das instâncias de
            atendimento. Se conflitar, comandos podem se misturar com
            conversas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Máx. telefones vinculados</Label>
          <Input
            type="number"
            min={1}
            max={50}
            value={maxPhonesPerOrg}
            onChange={(e) => setMaxPhonesPerOrg(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label>Máx. comandos por hora (por binding)</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={maxCmdsPerHour}
            onChange={(e) => setMaxCmdsPerHour(Number(e.target.value))}
          />
        </div>
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
          processados (proativos do bot também ficam silenciados).
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Ativar bot na organização</p>
          <p className="text-xs text-muted-foreground">
            {bindingCount} vínculo(s) ativo(s) hoje
          </p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>

      {isActive && provider === "UAZAPI" && !uazapiInstanceId && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          <AlertTriangle className="size-4 text-yellow-600 shrink-0 mt-0.5" />
          <p>
            Você marcou como ativo, mas ainda não selecionou a instância. O bot
            só vai responder quando uma instância UAZAPI estiver vinculada.
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
