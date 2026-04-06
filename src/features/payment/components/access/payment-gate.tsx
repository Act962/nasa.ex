"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Landmark, Lock, Eye, EyeOff, Loader2, ShieldX } from "lucide-react";
import { useVerifyPaymentPin } from "../../hooks/use-payment";
import { toast } from "sonner";

const SESSION_KEY = "nasa_payment_unlocked";

export function PaymentGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const verify = useVerifyPaymentPin();

  // Checa sessão (válida apenas enquanto a aba está aberta)
  useEffect(() => {
    const ok = sessionStorage.getItem(SESSION_KEY) === "1";
    setUnlocked(ok);
    setChecking(false);
    if (!ok) setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const LOCKED_OUT = attempts >= 5;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || LOCKED_OUT) return;
    try {
      const result = await verify.mutateAsync({ pin });
      if (result.ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setUnlocked(true);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setPin("");
        if (next >= 5) {
          toast.error("Muitas tentativas. Acesso bloqueado nesta sessão.");
        } else {
          toast.error(`PIN incorreto. Tentativa ${next}/5.`);
        }
        inputRef.current?.focus();
      }
    } catch {
      toast.error("Erro ao verificar PIN");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-16 rounded-2xl bg-[#1E90FF]/10 border border-[#1E90FF]/20 flex items-center justify-center">
          {LOCKED_OUT ? (
            <ShieldX className="size-8 text-red-500" />
          ) : (
            <Landmark className="size-8 text-[#1E90FF]" />
          )}
        </div>
        <h1 className="text-xl font-bold">NASA Payment</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {LOCKED_OUT
            ? "Acesso bloqueado após 5 tentativas incorretas. Recarregue a página para tentar novamente."
            : "Módulo financeiro protegido. Insira seu PIN de acesso para continuar."}
        </p>
      </div>

      {!LOCKED_OUT && (
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              placeholder="PIN de acesso"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="pl-9 pr-10 text-center tracking-widest text-lg h-12"
              disabled={verify.isPending}
              autoComplete="off"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={verify.isPending || !pin.trim()}
            className="w-full h-11 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
          >
            {verify.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Verificando...</>
            ) : (
              <><Lock className="size-4 mr-2" />Desbloquear</>
            )}
          </Button>
        </form>
      )}

      <p className="text-xs text-muted-foreground">
        Não possui PIN? Solicite ao administrador do sistema.
      </p>
    </div>
  );
}
