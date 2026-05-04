"use client";

import { useState } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SaveReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  filters: any;
  modules: string[];
  snapshot: any;
  aiNarrative?: string;
}

export function SaveReportModal({
  open,
  onOpenChange,
  defaultName = "",
  filters,
  modules,
  snapshot,
  aiNarrative,
}: SaveReportModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (vars: {
      name: string;
      description?: string;
      filters: any;
      modules: string[];
      snapshot: any;
      aiNarrative?: string;
      generateShareToken: boolean;
    }) => orpc.insights.saveReport.call(vars),
    onSuccess: (data) => {
      toast.success("Relatório salvo!");
      setSavedToken(data.report.shareToken ?? null);
      queryClient.invalidateQueries({ queryKey: ["insights", "listSavedReports"] });
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${(err as Error).message}`);
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Dê um nome ao relatório");
      return;
    }
    mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      filters,
      modules,
      snapshot,
      aiNarrative,
      generateShareToken: makePublic,
    });
  };

  const handleClose = () => {
    setSavedToken(null);
    setName(defaultName);
    setDescription("");
    setMakePublic(true);
    onOpenChange(false);
  };

  const publicUrl = savedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/insights/r/${savedToken}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar relatório</DialogTitle>
          <DialogDescription>
            Os dados serão congelados como snapshot — você poderá comparar com
            outros relatórios depois.
          </DialogDescription>
        </DialogHeader>

        {!savedToken ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Nome*</Label>
              <Input
                id="report-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Q1 2026 - Funil completo"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-desc">Descrição</Label>
              <Textarea
                id="report-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que você está analisando neste relatório?"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="public-switch" className="text-sm">
                  Link público
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite compartilhar via URL sem login
                </p>
              </div>
              <Switch
                id="public-switch"
                checked={makePublic}
                onCheckedChange={setMakePublic}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <Check className="size-5" />
              <span className="text-sm font-medium">Relatório salvo com sucesso!</span>
            </div>
            {publicUrl && (
              <div className="space-y-2">
                <Label>Link público</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link copiado!");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!savedToken ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isPending} className="gap-2">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
