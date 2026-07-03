"use client";

/**
 * Aba "Leads" das configurações do Tracking. Por enquanto contém apenas o
 * bloco "Configuração de Período de Compra" que controla a cesta de compra
 * (ícone colorido no card do lead).
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShoppingBasket } from "lucide-react";

interface Props {
  trackingId: string;
}

export function LeadsSettings({ trackingId }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    orpc.tracking.getCardConfig.queryOptions({ input: { trackingId } }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (data as any)?.config as
    | {
        showPurchaseBasket?: boolean;
        basketRecentDays?: number;
        basketMediumDays?: number;
        basketLongDays?: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields?: any[];
      }
    | undefined;

  const [showBasket, setShowBasket] = useState(true);
  const [recent, setRecent] = useState(30);
  const [medium, setMedium] = useState(60);
  const [long, setLong] = useState(90);

  useEffect(() => {
    if (!cfg) return;
    setShowBasket(cfg.showPurchaseBasket ?? true);
    setRecent(cfg.basketRecentDays ?? 30);
    setMedium(cfg.basketMediumDays ?? 60);
    setLong(cfg.basketLongDays ?? 90);
  }, [cfg]);

  const updateMutation = useMutation({
    ...orpc.tracking.updateCardConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["trackings", "getCardConfig"],
      });
    },
  });

  function handleSave() {
    if (!(recent < medium && medium < long)) {
      toast.error(
        "Os prazos precisam ser crescentes: recente < intermediário < longo",
      );
      return;
    }
    updateMutation.mutate(
      {
        trackingId,
        fields: cfg?.fields ?? [],
        showPurchaseBasket: showBasket,
        basketRecentDays: recent,
        basketMediumDays: medium,
        basketLongDays: long,
      },
      {
        onSuccess: () => toast.success("Configuração de período salva"),
        onError: () => toast.error("Erro ao salvar"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBasket className="size-4 text-[#1E90FF]" /> Configuração de
          Período de Compra
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Define quando o ícone da cesta muda de cor no card do lead. A cesta
          reflete a última compra do lead (Payment pago ou ForgeContract
          ativo).
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Mostrar cesta no card</Label>
            <p className="text-xs text-muted-foreground">
              Desligar esconde o ícone em todos os cards deste tracking.
            </p>
          </div>
          <Switch checked={showBasket} onCheckedChange={setShowBasket} />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-emerald-500" />
              Verde (recente, até)
            </Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={recent}
              onChange={(event) => setRecent(Number(event.target.value))}
              disabled={!showBasket}
            />
            <p className="text-[10px] text-muted-foreground">dias</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-yellow-500" />
              Amarelo (intermediário, até)
            </Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={medium}
              onChange={(event) => setMedium(Number(event.target.value))}
              disabled={!showBasket}
            />
            <p className="text-[10px] text-muted-foreground">dias</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-orange-500" />
              Laranja (longo, até)
            </Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={long}
              onChange={(event) => setLong(Number(event.target.value))}
              disabled={!showBasket}
            />
            <p className="text-[10px] text-muted-foreground">dias</p>
          </div>
        </div>

        <div className="border-t pt-3 space-y-1 text-[11px] text-muted-foreground">
          <p>
            <span className="inline-block size-2 rounded-sm bg-emerald-500 mr-1.5" />
            Verde: comprou nos últimos {recent} dias
          </p>
          <p>
            <span className="inline-block size-2 rounded-sm bg-yellow-500 mr-1.5" />
            Amarelo: entre {recent + 1} e {medium} dias
          </p>
          <p>
            <span className="inline-block size-2 rounded-sm bg-orange-500 mr-1.5" />
            Laranja: entre {medium + 1} e {long} dias
          </p>
          <p>
            <span className="inline-block size-2 rounded-sm bg-red-500 mr-1.5" />
            Vermelho: passou de {long} dias
          </p>
          <p>
            <span className="inline-block size-2 rounded-sm bg-zinc-400 mr-1.5" />
            Cinza: ainda não comprou
          </p>
        </div>
      </Card>

      <div>
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !showBasket ? false : false}
        >
          {updateMutation.isPending && (
            <Loader2 className="size-4 animate-spin mr-2" />
          )}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
