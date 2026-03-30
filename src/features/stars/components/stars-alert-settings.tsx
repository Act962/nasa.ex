"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";

interface AlertConfig {
  alertAt20: boolean;
  alertAt10: boolean;
  alertAt5: boolean;
  notifyByEmail: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
  alertAt20: true,
  alertAt10: true,
  alertAt5: true,
  notifyByEmail: true,
};

interface StarsAlertSettingsProps {
  initialConfig?: Partial<AlertConfig>;
  className?: string;
}

export function StarsAlertSettings({ initialConfig, className }: StarsAlertSettingsProps) {
  const [config, setConfig] = useState<AlertConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig({ ...DEFAULT_CONFIG, ...initialConfig });
    }
  }, [initialConfig]);

  const { mutate: save, isPending } = useMutation({
    ...orpc.stars.updateAlertConfig.mutationOptions(),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const toggleField = (field: keyof AlertConfig) => {
    setConfig((prev) => ({ ...prev, [field]: !prev[field] }));
    setSaved(false);
  };

  const alerts = [
    { key: "alertAt20" as const, label: "Alertar com 20% do saldo", description: "Aviso preventivo para planejar recarga" },
    { key: "alertAt10" as const, label: "Alertar com 10% do saldo", description: "Saldo baixo — recarregue em breve" },
    { key: "alertAt5" as const, label: "Alertar com 5% do saldo", description: "Saldo crítico — integrações em risco" },
    { key: "notifyByEmail" as const, label: "Notificar por e-mail", description: "Receba alertas no seu e-mail cadastrado" },
  ];

  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-4", className)}>
      <div>
        <p className="font-semibold text-sm">Alertas de saldo ★</p>
        <p className="text-[11px] text-muted-foreground">
          Configure quando receber avisos sobre seu saldo de Stars.
        </p>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.key} className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-medium cursor-pointer" htmlFor={alert.key}>
                {alert.label}
              </Label>
              <p className="text-[11px] text-muted-foreground">{alert.description}</p>
            </div>
            <Switch
              id={alert.key}
              checked={config[alert.key]}
              onCheckedChange={() => toggleField(alert.key)}
            />
          </div>
        ))}
      </div>

      <Button
        size="sm"
        onClick={() => save(config)}
        disabled={isPending}
        className={cn(
          "w-full gap-2 font-semibold transition-all",
          saved
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        )}
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> Salvando...</>
        ) : saved ? (
          <><CheckCircle2 className="size-4" /> Configurações salvas!</>
        ) : (
          "Salvar configurações"
        )}
      </Button>
    </div>
  );
}
