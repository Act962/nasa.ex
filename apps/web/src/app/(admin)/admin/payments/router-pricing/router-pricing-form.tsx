"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

export function RouterPricingForm() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    ...orpc.admin.getRouterPaymentSettings.queryOptions(),
  });

  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (data && value === "") {
      setValue(data.starPriceBrl.toFixed(4));
    }
  }, [data, value]);

  const updateMutation = useMutation({
    ...orpc.admin.updateRouterPaymentSettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Cotação atualizada com sucesso.");
      queryClient.invalidateQueries({
        queryKey: orpc.admin.getRouterPaymentSettings.queryKey(),
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao atualizar a cotação.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = Number(value.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 0.01 || numeric > 100) {
      toast.error("Cotação deve estar entre R$ 0,01 e R$ 100,00.");
      return;
    }
    updateMutation.mutate({ starPriceBrl: numeric });
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  }

  const numericPreview = Number(value.replace(",", ".")) || 0;
  const previewBrl = (50 * numericPreview).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="starPriceBrl" className="text-zinc-200">
          Valor de 1 ★ em BRL
        </Label>
        <Input
          id="starPriceBrl"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0,1500"
          className="max-w-xs"
        />
        <p className="text-xs text-zinc-500">
          Aceita até 4 casas decimais. Ex.: <code>0.1500</code> = R$ 0,15.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300 space-y-1">
        <p>
          Curso de <strong>50 ★</strong> custaria{" "}
          <strong className="text-violet-300">{previewBrl}</strong> no checkout
          público.
        </p>
        {data?.updatedBy && data.updatedAt && (
          <p className="text-xs text-zinc-500 mt-2">
            Última atualização:{" "}
            {new Date(data.updatedAt).toLocaleString("pt-BR")} por{" "}
            <strong>{data.updatedBy.name}</strong> ({data.updatedBy.email}).
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={updateMutation.isPending}
        className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
      >
        {updateMutation.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Salvando…
          </>
        ) : (
          <>
            <Save className="size-4" /> Salvar cotação
          </>
        )}
      </Button>
    </form>
  );
}
