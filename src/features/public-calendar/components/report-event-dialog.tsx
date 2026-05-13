"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

const REPORT_REASONS = [
  { value: "BRAND_MISUSE", label: "Uso indevido de marca" },
  { value: "FAKE", label: "Evento falso ou enganoso" },
  { value: "OFFENSIVE", label: "Conteúdo ofensivo" },
  { value: "DUPLICATE", label: "Evento duplicado" },
  { value: "OTHER", label: "Outro motivo" },
] as const;

/**
 * Modal compacto "Denunciar evento" — menos invasivo que reivindicar.
 * Soma `weight` em `Action.reportScore`. Quando score atinge threshold,
 * evento ganha flag `isDisputed=true` automaticamente.
 */
export function ReportEventDialog({
  actionId,
  trigger,
}: {
  actionId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<typeof REPORT_REASONS[number]["value"]>(
    "BRAND_MISUSE",
  );
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation(
    orpc.public.calendar.submitReport.mutationOptions({
      onSuccess: () => {
        toast.success("Denúncia registrada", {
          description: "Obrigado pela colaboração.",
        });
        setDetail("");
        setEmail("");
        setOpen(false);
      },
      onError: (err) => {
        const msg = (err as { message?: string })?.message ?? "Falha ao denunciar";
        toast.error(msg);
      },
    }),
  );

  function submit() {
    mutation.mutate({
      actionId,
      reason,
      detail: detail.trim() || undefined,
      email: email.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Flag className="size-3.5" />
            Denunciar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Denunciar evento</DialogTitle>
          <DialogDescription>
            Vamos analisar se o evento viola alguma regra do calendário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Select
              value={reason}
              onValueChange={(v) =>
                setReason(v as typeof REPORT_REASONS[number]["value"])
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Detalhes (opcional)</Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Explique brevemente..."
              maxLength={2000}
              className="min-h-[80px] resize-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Seu email (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="você@email.com"
              maxLength={200}
              className="h-9"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="size-3 animate-spin mr-1.5" />
            )}
            Enviar denúncia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
