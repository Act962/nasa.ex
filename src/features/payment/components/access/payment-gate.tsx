"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Landmark,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldX,
  ShieldCheck,
  MessageCircle,
  Fingerprint,
  KeyRound,
} from "lucide-react";
import {
  useVerifyPaymentPin,
  useVerifyPaymentOtp,
  useRequestPaymentOtp,
  useMyPaymentAccess,
  useStartWebauthnAuth,
  useFinishWebauthnAuth,
} from "../../hooks/use-payment";
import { toast } from "sonner";
import { startAuthentication } from "@simplewebauthn/browser";

const SESSION_KEY = "nasa_payment_unlocked";
const SESSION_EXPIRES_KEY = "nasa_payment_unlocked_expires";
const SESSION_LAST_ACTIVITY_KEY = "nasa_payment_last_activity";
const DEFAULT_TIMEOUT_MIN = 30;

type Step = "password" | "otp";

/**
 * Gate de segurança do módulo NASA Payment.
 *
 * Fluxo:
 *  1. Sessão válida (sessionStorage + idle timer) → libera direto.
 *  2. Senão pede senha permanente. Se backend disser requiresOtp, vai pro
 *     passo OTP (código enviado por WhatsApp).
 *  3. WebAuthn (Face ID / Touch ID) pode substituir a senha quando o usuário
 *     tiver credencial registrada — botão "Usar Face ID / Touch ID".
 *
 * Auto-lock por inatividade: monitora mouse/keyboard; depois de
 * `sessionTimeoutMinutes` sem atividade, força novo desbloqueio.
 */
export function PaymentGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("password");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [timeoutMin, setTimeoutMin] = useState(DEFAULT_TIMEOUT_MIN);
  const inputRef = useRef<HTMLInputElement>(null);

  const my = useMyPaymentAccess();
  const verifyPin = useVerifyPaymentPin();
  const verifyOtp = useVerifyPaymentOtp();
  const requestOtp = useRequestPaymentOtp();
  const startWebauthn = useStartWebauthnAuth();
  const finishWebauthn = useFinishWebauthnAuth();

  const hasWebauthn = my.data?.hasWebauthn ?? false;

  // ── Sessão & idle timer ────────────────────────────────────────────────────

  const lockSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    setUnlocked(false);
    setStep("password");
    setPin("");
    setOtp("");
  }, []);

  const markActivity = useCallback(() => {
    const now = Date.now().toString();
    sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now);
  }, []);

  // Carga inicial: confere sessão e expiração
  useEffect(() => {
    const ok = sessionStorage.getItem(SESSION_KEY) === "1";
    const expiresRaw = sessionStorage.getItem(SESSION_EXPIRES_KEY);
    const lastActivityRaw = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    const expires = expiresRaw ? parseInt(expiresRaw, 10) : 0;
    const lastActivity = lastActivityRaw ? parseInt(lastActivityRaw, 10) : 0;
    const now = Date.now();
    const idleTimeoutMs = (my.data?.sessionTimeoutMinutes ?? DEFAULT_TIMEOUT_MIN) * 60_000;
    const stillValid =
      ok && expires > now && (lastActivity === 0 || now - lastActivity < idleTimeoutMs);

    setUnlocked(stillValid);
    if (!stillValid && ok) lockSession();
    setChecking(false);
    if (!stillValid) setTimeout(() => inputRef.current?.focus(), 100);
  }, [my.data?.sessionTimeoutMinutes, lockSession]);

  // Atualiza o timeout local quando dados do server chegam
  useEffect(() => {
    if (my.data?.sessionTimeoutMinutes) {
      setTimeoutMin(my.data.sessionTimeoutMinutes);
    }
  }, [my.data?.sessionTimeoutMinutes]);

  // Idle timer: re-checa a cada minuto e instala listeners enquanto unlocked
  useEffect(() => {
    if (!unlocked) return;
    markActivity();
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keypress",
      "touchstart",
      "scroll",
    ];
    events.forEach((event) => window.addEventListener(event, markActivity));
    const interval = window.setInterval(() => {
      const lastActivityRaw = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
      const lastActivity = lastActivityRaw ? parseInt(lastActivityRaw, 10) : 0;
      const idleTimeoutMs = timeoutMin * 60_000;
      if (lastActivity && Date.now() - lastActivity > idleTimeoutMs) {
        lockSession();
        toast.info(`Sessão expirada por ${timeoutMin}min de inatividade.`);
      }
    }, 30_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      window.clearInterval(interval);
    };
  }, [unlocked, markActivity, timeoutMin, lockSession]);

  function persistUnlocked() {
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(
      SESSION_EXPIRES_KEY,
      String(Date.now() + timeoutMin * 60_000 * 8),
    );
    sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
    setUnlocked(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (checking || my.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  // Usuário sem PaymentAccess → tela de bloqueio total
  if (my.data && !my.data.authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4 text-center">
        <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldX className="size-8 text-red-500" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h1 className="text-xl font-bold">Acesso financeiro restrito</h1>
          <p className="text-sm text-muted-foreground">
            Apenas pessoas autorizadas em <strong>Permissões → Acesso Financeiro</strong> podem
            entrar no módulo NASA Payment. Procure o responsável pelo financeiro
            da sua organização para solicitar acesso.
          </p>
        </div>
      </div>
    );
  }

  const LOCKED_OUT = attempts >= 5;

  async function handlePinSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pin.trim() || LOCKED_OUT) return;
    try {
      const result = await verifyPin.mutateAsync({ pin });
      if (result.ok) {
        if (result.sessionTimeoutMinutes) setTimeoutMin(result.sessionTimeoutMinutes);
        persistUnlocked();
        toast.success("Acesso liberado");
      } else if (result.requiresOtp) {
        setStep("otp");
        setPin("");
        toast.info("Senha OK. Digite o código enviado pro seu WhatsApp.");
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setPin("");
        toast.error(
          next >= 5
            ? "Muitas tentativas. Acesso bloqueado nesta sessão."
            : `Senha incorreta. Tentativa ${next}/5.`,
        );
        inputRef.current?.focus();
      }
    } catch {
      toast.error("Erro ao verificar senha");
    }
  }

  async function handleOtpSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!otp.trim()) return;
    try {
      const result = await verifyOtp.mutateAsync({ otp });
      if (result.ok) {
        if (result.sessionTimeoutMinutes) setTimeoutMin(result.sessionTimeoutMinutes);
        persistUnlocked();
        toast.success("Acesso liberado");
      } else {
        toast.error("Código inválido ou expirado");
        setOtp("");
      }
    } catch {
      toast.error("Erro ao verificar código");
    }
  }

  async function handleResendOtp() {
    try {
      const result = await requestOtp.mutateAsync({});
      if (result.ok) toast.success("Novo código enviado pro WhatsApp");
      else if (result.cooldownSeconds)
        toast.warning(`Aguarde ${result.cooldownSeconds}s pra reenviar.`);
      else toast.error("Não foi possível reenviar — sem telefone cadastrado?");
    } catch {
      toast.error("Erro ao reenviar código");
    }
  }

  async function handleWebauthn() {
    try {
      const { options } = await startWebauthn.mutateAsync({});
      const response = await startAuthentication({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        optionsJSON: options as any,
      });
      const result = await finishWebauthn.mutateAsync({ response });
      if (result.ok) {
        if (result.sessionTimeoutMinutes) setTimeoutMin(result.sessionTimeoutMinutes);
        persistUnlocked();
        toast.success("Liberado com Face ID / Touch ID");
      } else {
        toast.error("Biometria não validada");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro na biometria");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-16 rounded-2xl bg-[#1E90FF]/10 border border-[#1E90FF]/20 flex items-center justify-center">
          {LOCKED_OUT ? (
            <ShieldX className="size-8 text-red-500" />
          ) : step === "otp" ? (
            <MessageCircle className="size-8 text-emerald-500" />
          ) : (
            <Landmark className="size-8 text-[#1E90FF]" />
          )}
        </div>
        <h1 className="text-xl font-bold">NASA Payment</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {LOCKED_OUT
            ? "Acesso bloqueado após 5 tentativas incorretas. Recarregue a página para tentar novamente."
            : step === "otp"
              ? "Verificação extra: digite o código de 6 dígitos enviado para o seu WhatsApp."
              : "Módulo financeiro protegido. Insira sua senha de acesso para continuar."}
        </p>
      </div>

      {!LOCKED_OUT && step === "password" && (
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              placeholder="Senha de acesso"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="pl-9 pr-10 text-center tracking-widest text-lg h-12"
              disabled={verifyPin.isPending}
              autoComplete="off"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPin((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            type="submit"
            disabled={verifyPin.isPending || !pin.trim()}
            className="w-full h-11 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
          >
            {verifyPin.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Verificando...</>
            ) : (
              <><ShieldCheck className="size-4 mr-2" />Desbloquear</>
            )}
          </Button>
          {hasWebauthn && (
            <Button
              type="button"
              variant="outline"
              disabled={startWebauthn.isPending || finishWebauthn.isPending}
              onClick={handleWebauthn}
              className="w-full h-11 gap-2"
            >
              <Fingerprint className="size-4" />
              {startWebauthn.isPending || finishWebauthn.isPending
                ? "Aguardando biometria..."
                : "Usar Face ID / Touch ID"}
            </Button>
          )}
        </form>
      )}

      {!LOCKED_OUT && step === "otp" && (
        <form onSubmit={handleOtpSubmit} className="w-full max-w-xs space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="Código WhatsApp"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              className="pl-9 text-center tracking-[0.5em] text-lg h-12"
              disabled={verifyOtp.isPending}
              autoComplete="one-time-code"
            />
          </div>
          <Button
            type="submit"
            disabled={verifyOtp.isPending || otp.length < 4}
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-500/90 text-white"
          >
            {verifyOtp.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Verificando...</>
            ) : (
              <><ShieldCheck className="size-4 mr-2" />Validar código</>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={requestOtp.isPending}
            onClick={handleResendOtp}
            className="w-full h-9 text-xs"
          >
            {requestOtp.isPending ? "Reenviando..." : "Reenviar código"}
          </Button>
        </form>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {step === "password"
          ? "Sem senha? Solicite ao OWNER do módulo em Permissões → Acesso Financeiro."
          : "Não recebeu? Verifique se seu telefone está cadastrado em Geral."}
      </p>
    </div>
  );
}
