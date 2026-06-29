"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Megaphone, Plus, RefreshCw, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import { MetaAccountSwitcher } from "@/features/integrations/components/meta-account-switcher";

const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App" },
];

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtNum = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-BR").format(Number(v));

const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toFixed(2)}%`;

const fmtX = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toFixed(2)}x`;

export function MetaAdsCampaignManager() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery(
    orpc.metaAds.campaigns.list.queryOptions({ input: { sync: false } }),
  );

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    try {
      setSyncing(true);
      await qc.fetchQuery(orpc.metaAds.campaigns.list.queryOptions({ input: { sync: true } }));
      qc.invalidateQueries({ queryKey: ["metaAds", "campaigns", "list"] });
      toast.success("Campanhas sincronizadas");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const createMutation = useMutation(
    orpc.metaAds.campaigns.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["metaAds", "campaigns", "list"] });
        toast.success("Campanha criada na Meta!");
        setCreateOpen(false);
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar campanha"),
    }),
  );

  const updateMutation = useMutation(
    orpc.metaAds.campaigns.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["metaAds", "campaigns", "list"] });
        toast.success("Campanha atualizada");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
    }),
  );

  const deleteMutation = useMutation(
    orpc.metaAds.campaigns.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["metaAds", "campaigns", "list"] });
        toast.success("Campanha excluída");
        setDeleteId(null);
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao excluir"),
    }),
  );

  const campaigns = data?.campaigns ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="size-4 text-[#0082FB]" />
          Gerenciar Campanhas Meta Ads
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <MetaAccountSwitcher />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5"
          >
            <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" /> Nova campanha
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma campanha. Sincronize ou crie uma nova.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Orç./dia</th>
                  <th className="text-right py-2 px-2 font-medium">Gasto 30d</th>
                  <th className="text-right py-2 px-2 font-medium">Impr.</th>
                  <th className="text-right py-2 px-2 font-medium">Cliques</th>
                  <th className="text-right py-2 px-2 font-medium">CTR</th>
                  <th className="text-right py-2 px-2 font-medium">CPC</th>
                  <th className="text-right py-2 px-2 font-medium">CPM</th>
                  <th className="text-right py-2 px-2 font-medium">Conv.</th>
                  <th className="text-right py-2 px-2 font-medium">CPA</th>
                  <th className="text-right py-2 px-2 font-medium">ROAS</th>
                  <th className="text-right py-2 px-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const k = (c as any).kpis as
                    | { spend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; cpm: number; cpa: number; roas: number }
                    | null;
                  return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 px-2 max-w-[220px] truncate" title={c.name}>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">{c.objective ?? "—"}</div>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right text-xs">{fmtCurrency(c.dailyBudget as number | null)}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtCurrency(k.spend) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtNum(k.impressions) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtNum(k.clicks) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtPct(k.ctr) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtCurrency(k.cpc) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtCurrency(k.cpm) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtNum(k.conversions) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs">{k ? fmtCurrency(k.cpa) : "—"}</td>
                    <td className="py-2 px-2 text-right text-xs font-medium">
                      <span className={k && k.roas >= 2 ? "text-emerald-600" : k && k.roas >= 1 ? "text-amber-600" : "text-muted-foreground"}>
                        {k ? fmtX(k.roas) : "—"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex justify-end gap-1">
                        {c.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => updateMutation.mutate({ id: c.id, status: "PAUSED" })}
                            title="Pausar"
                          >
                            <PauseCircle className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => updateMutation.mutate({ id: c.id, status: "ACTIVE" })}
                            title="Ativar"
                          >
                            <PlayCircle className="size-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setDeleteId(c.id)}
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(values) => createMutation.mutate(values)}
        isPending={createMutation.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a campanha na Meta e localmente. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CreateCampaignDialog({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: {
    name: string;
    objective: string;
    status: "PAUSED" | "ACTIVE";
    specialAdCategories: string[];
    dailyBudget?: number;
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_LEADS");
  const [status, setStatus] = useState<"PAUSED" | "ACTIVE">("PAUSED");
  const [dailyBudgetBrl, setDailyBudgetBrl] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const dailyCents = dailyBudgetBrl ? Math.round(parseFloat(dailyBudgetBrl) * 100) : undefined;
    onCreate({
      name: name.trim(),
      objective,
      status,
      specialAdCategories: [],
      dailyBudget: dailyCents,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova campanha Meta Ads</DialogTitle>
          <DialogDescription>
            A campanha será criada na Meta no status escolhido. Ad sets e anúncios podem ser adicionados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Black Friday 2026" />
          </div>

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "PAUSED" | "ACTIVE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PAUSED">Pausada</SelectItem>
                <SelectItem value="ACTIVE">Ativa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Orçamento diário (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={dailyBudgetBrl}
              onChange={(e) => setDailyBudgetBrl(e.target.value)}
              placeholder="Opcional — defina depois no ad set"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Criando..." : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
