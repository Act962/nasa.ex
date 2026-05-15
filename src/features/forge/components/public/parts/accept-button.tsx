"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light";

interface Props {
  token: string;
  client?: {
    name: string;
    email: string | null;
    phone: string | null;
    document?: string | null;
  } | null;
  isExpired: boolean;
  isPaid: boolean;
  variant?: Variant;
  accentClassName?: string;
}

export function AcceptButton({
  token,
  client,
  isExpired,
  isPaid,
  variant = "dark",
  accentClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    document: client?.document ?? "",
  });

  const acceptMutation = useMutation(
    orpc.forge.proposals.acceptAsContract.mutationOptions(),
  );

  if (isPaid) return null;

  const disabled = isExpired || acceptMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    try {
      const result = await acceptMutation.mutateAsync({
        token,
        clientName: form.name.trim(),
        clientEmail: form.email.trim(),
        clientPhone: form.phone.trim() || undefined,
        clientDocument: form.document.trim() || undefined,
      });
      toast.success(
        result.reused
          ? "Você já havia aceitado — redirecionando para assinatura"
          : "Proposta aceita! Redirecionando para assinatura digital",
      );
      // Redireciona pro fluxo de assinatura existente
      window.location.href = `/contrato/${result.signerToken}`;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao aceitar a proposta";
      toast.error(msg);
    }
  };

  const defaultAccent =
    variant === "dark"
      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 text-white shadow-lg shadow-emerald-900/30"
      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md";

  return (
    <div className="max-w-3xl mx-auto px-8 pb-8 forge-no-print">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={isExpired ? "Proposta expirada" : "Aceitar e assinar"}
        className={cn(
          "w-full flex items-center justify-center gap-3 rounded-xl py-4 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          accentClassName ?? defaultAccent,
        )}
      >
        <CheckCircle2 className="size-5" />
        {isExpired ? "Proposta expirada" : "Aceitar e assinar proposta"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar aceite</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao aceitar, geramos um contrato com seus dados e te enviamos para
              a assinatura digital.
            </p>
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={form.document}
                  onChange={(e) =>
                    setForm({ ...form, document: e.target.value })
                  }
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={acceptMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={acceptMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 mr-2" />
                    Aceitar e ir para assinatura
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
