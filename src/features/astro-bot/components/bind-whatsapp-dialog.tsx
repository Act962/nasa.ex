"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useStartBindingOtp,
  useVerifyBindingOtp,
} from "@/features/astro-bot/hooks/use-astro-bot";
import { Loader2, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Step = "phone" | "otp" | "pin" | "done";

/**
 * Fluxo 3-step de vincular WhatsApp pessoal ao Astro Bot.
 * 1) Telefone E.164 → dispara OTP por email.
 * 2) OTP recebido por email + PIN escolhido pelo user.
 * 3) Sucesso — instruções pra mandar primeira mensagem.
 */
export function BindWhatsappDialog({
  trigger,
  onSuccess,
}: {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const startOtp = useStartBindingOtp();
  const verifyOtp = useVerifyBindingOtp();

  const reset = () => {
    setStep("phone");
    setPhone("");
    setOtp("");
    setPin("");
    setPinConfirm("");
  };

  const handleStartOtp = () => {
    if (!/^\d{10,15}$/.test(phone)) {
      toast.error("Telefone deve ser só dígitos (10-15) com DDI + DDD");
      return;
    }
    startOtp.mutate(
      { phoneE164: phone },
      {
        onSuccess: () => {
          toast.success("Código enviado pro seu email cadastrado");
          setStep("otp");
        },
        onError: (e) => toast.error(e.message || "Erro ao enviar código"),
      },
    );
  };

  const handleVerify = () => {
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Código OTP deve ter 6 dígitos");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN deve ter 4-6 dígitos");
      return;
    }
    if (pin !== pinConfirm) {
      toast.error("PINs não conferem");
      return;
    }
    verifyOtp.mutate(
      { phoneE164: phone, otp, pin },
      {
        onSuccess: () => {
          toast.success("WhatsApp vinculado!");
          setStep("done");
          onSuccess?.();
        },
        onError: (e) => toast.error(e.message || "Erro ao validar"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <MessageCircle className="size-4 mr-2" />
            Vincular meu WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular WhatsApp ao Astro Bot</DialogTitle>
          <DialogDescription>
            Vamos vincular seu número pra você conversar direto com o Astro pelo
            seu WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smartphone className="size-4" /> Telefone (DDI + DDD + número)
              </Label>
              <Input
                placeholder="5511999998888"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
              />
              <p className="text-xs text-muted-foreground">
                Apenas dígitos, ex: <span className="font-mono">5511...</span>{" "}
                pra Brasil. Esse é o número que vai mandar comandos pro bot.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={handleStartOtp}
                disabled={startOtp.isPending || !phone}
              >
                {startOtp.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Enviar código por email"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm bg-muted/30">
              Enviamos um código de 6 dígitos pro seu email cadastrado. Cola ele
              aqui e escolhe seu PIN.
            </div>
            <div className="space-y-2">
              <Label>Código recebido por email</Label>
              <Input
                placeholder="000000"
                inputMode="numeric"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Crie seu PIN (4-6 dígitos)
              </Label>
              <Input
                placeholder="••••"
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <Input
                placeholder="Confirme o PIN"
                inputMode="numeric"
                type="password"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <p className="text-xs text-muted-foreground">
                Você vai usar o PIN pra autenticar comandos sensíveis (ações,
                deletes) no WhatsApp.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep("phone")}
                disabled={verifyOtp.isPending}
              >
                Voltar
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifyOtp.isPending || !otp || !pin || !pinConfirm}
              >
                {verifyOtp.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Confirmar vínculo"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Tudo certo!
              </p>
              <p className="text-sm">
                Abre seu WhatsApp e manda qualquer mensagem pro número do bot.
                Comandos sensíveis vão pedir seu PIN.
              </p>
              <p className="text-sm text-muted-foreground">
                Exemplos: <span className="font-mono">liste leads</span>,{" "}
                <span className="font-mono">quantos atendimentos hoje?</span>
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
