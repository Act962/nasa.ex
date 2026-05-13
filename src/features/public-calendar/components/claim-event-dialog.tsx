"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
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
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

/**
 * Modal "Reivindicar este evento" — qualquer pessoa (auth ou não)
 * pode submeter dizendo "esse evento usa minha marca / sou eu o
 * organizador". Submete via `public.calendar.submitClaim`.
 *
 * Resultado: criador recebe email + in-app, tem 7 dias pra responder.
 * Se não responder, evento despublica automaticamente.
 */
export function ClaimEventDialog({
  actionId,
  trigger,
}: {
  actionId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");

  const mutation = useMutation(
    orpc.public.calendar.submitClaim.mutationOptions({
      onSuccess: (data) => {
        const d = data as { message?: string };
        toast.success("Reivindicação enviada", {
          description:
            d.message ??
            "O criador recebeu email e tem 7 dias pra responder.",
        });
        setName("");
        setEmail("");
        setReason("");
        setEvidence("");
        setOpen(false);
      },
      onError: (err) => {
        const msg =
          (err as { message?: string })?.message ??
          "Falha ao enviar reivindicação";
        toast.error(msg);
      },
    }),
  );

  function submit() {
    if (!name.trim() || !email.trim() || reason.trim().length < 20) return;
    const evidenceUrls = evidence
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s))
      .slice(0, 10);
    mutation.mutate({
      actionId,
      name: name.trim(),
      email: email.trim(),
      reason: reason.trim(),
      evidence: evidenceUrls.length > 0 ? evidenceUrls : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <ShieldAlert className="size-3.5" />
            Reivindicar este evento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reivindicar evento</DialogTitle>
          <DialogDescription>
            Se este evento usa sua marca ou foi cadastrado em seu nome sem
            autorização, envie uma reivindicação. O criador recebe email e
            tem 7 dias pra responder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Seu nome completo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              maxLength={200}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email corporativo</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@suamarca.com"
              maxLength={200}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Motivo (mín. 20 caracteres)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Sou o organizador oficial deste evento e ele foi cadastrado por outra pessoa..."
              maxLength={2000}
              className="min-h-[100px] resize-none text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              {reason.length}/2000 caracteres
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Links de prova (opcional)</Label>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="https://site-oficial.com&#10;https://instagram.com/marca"
              className="min-h-[60px] resize-none text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Cole URLs separadas por espaço/linha. Máx. 10.
            </p>
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
          <Button
            onClick={submit}
            disabled={
              mutation.isPending ||
              !name.trim() ||
              !email.trim() ||
              reason.trim().length < 20
            }
          >
            {mutation.isPending && <Loader2 className="size-3 animate-spin mr-1.5" />}
            Enviar reivindicação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
