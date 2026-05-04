"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, ShoppingBag, Star } from "lucide-react";

interface PublicCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  course: {
    id: string;
    title: string;
    creatorOrgName: string;
  };
  plan: {
    id: string;
    name: string;
    priceStars: number;
  };
  amountBrl: number;
}

/**
 * Modal de compra pública: aluno sem conta digita e-mail e é redirecionado
 * pro Stripe Checkout. Após pagar, recebe e-mail com link `/resgatar/<token>`
 * pra criar conta + acessar o curso.
 */
export function PublicCheckoutModal({
  open,
  onClose,
  course,
  plan,
  amountBrl,
}: PublicCheckoutModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const amountStr = amountBrl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/checkout/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          planId: plan.id,
          email: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Erro ao iniciar checkout.");
        setIsLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("[public-checkout] submit failed:", err);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isLoading) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-violet-600" />
            Comprar curso
          </DialogTitle>
          <DialogDescription>
            Pagamento via cartão de crédito (Stripe). Após confirmar, você
            recebe um e-mail para criar sua conta e acessar o curso.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Curso
            </p>
            <p className="font-semibold">{course.title}</p>
            <p className="text-xs text-muted-foreground">
              Por {course.creatorOrgName}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Plano
              </p>
              <p className="text-sm font-medium">{plan.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                {amountStr}
              </p>
              <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="size-3 fill-amber-500 text-amber-500" />
                {plan.priceStars.toLocaleString("pt-BR")} ★
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              Seu e-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Vamos enviar o link de acesso pra esse e-mail. Sua conta NASA
              será criada com ele.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Indo pro Stripe…
                </>
              ) : (
                <>Pagar {amountStr}</>
              )}
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Pagamento processado por <strong>Stripe</strong> · Cartão de
            crédito · Reembolso conforme política
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
