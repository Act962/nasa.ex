"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useAddMetaNumber,
  useMetaSetupStatus,
  useRequestMetaCode,
  useSelectMetaPhone,
  useVerifyMetaCode,
} from "../../hooks/use-meta-setup";
import { useSalvyLatestCode } from "../../hooks/use-official-number";

const QUALITY_LABEL: Record<string, string> = { GREEN: "Alta", YELLOW: "Média", RED: "Baixa" };

/**
 * O número do funil (spec 0040, RF-12): usa um que já está na conta ou
 * cadastra um novo — a ÓRBITA pede o código, valida e registra sozinha.
 */
export function NumberSetup({
  trackingId,
  presetPhone,
  salvyNumberId,
  onConnected,
}: {
  trackingId: string;
  presetPhone?: string | null;
  salvyNumberId?: string | null;
  onConnected: () => void;
}) {
  const { data: status, isLoading, refetch, isFetching } = useMetaSetupStatus(trackingId);
  const selectPhone = useSelectMetaPhone();
  const addNumber = useAddMetaNumber();
  const requestCode = useRequestMetaCode();
  const verifyCode = useVerifyMetaCode();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(presetPhone ?? "");
  const [verifiedName, setVerifiedName] = useState("");
  const [pendingPhoneId, setPendingPhoneId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { data: salvyCode } = useSalvyLatestCode(salvyNumberId ?? null, { enabled: Boolean(pendingPhoneId && salvyNumberId) });

  useEffect(() => {
    if (salvyCode?.code && !code) setCode(salvyCode.code);
  }, [salvyCode, code]);

  useEffect(() => {
    if (status?.phone) onConnected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.phone?.id]);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Conferindo sua conta na Meta…
      </p>
    );
  }
  if (!status?.hasKeys) {
    return <p className="text-sm text-muted-foreground">Cole suas 3 chaves primeiro (passo 33).</p>;
  }

  if (status.phone) {
    return (
      <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4" /> Número conectado: {status.phone.displayNumber}
        </p>
        <p className="text-muted-foreground">
          Nome: {status.phone.verifiedName ?? "—"} · Qualidade: {QUALITY_LABEL[status.phone.quality ?? ""] ?? "sem dados ainda"}
        </p>
      </div>
    );
  }

  function startNew() {
    addNumber.mutate(
      { trackingId, phoneNumber, verifiedName },
      {
        onSuccess: (result) => {
          setPendingPhoneId(result.phoneNumberId);
          toast.success("Pedimos o código. Ele chega por SMS no número.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function confirmCode() {
    if (!pendingPhoneId) return;
    verifyCode.mutate(
      { trackingId, phoneNumberId: pendingPhoneId, code },
      {
        onSuccess: () => {
          toast.success("Número confirmado e registrado!");
          refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  if (pendingPhoneId) {
    return (
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Digite o código de 6 dígitos que chegou por SMS</p>
        {salvyNumberId && !salvyCode && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Esperando o SMS chegar no seu número comprado…
          </p>
        )}
        <div className="flex gap-2">
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" inputMode="numeric" className="max-w-40 text-center font-mono text-lg tracking-widest" />
          <Button onClick={confirmCode} disabled={code.replace(/\D/g, "").length < 6 || verifyCode.isPending}>
            {verifyCode.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar
          </Button>
        </div>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={requestCode.isPending}
          onClick={() =>
            requestCode.mutate(
              { trackingId, phoneNumberId: pendingPhoneId, codeMethod: "VOICE" },
              { onSuccess: () => toast.info("Vamos ligar para o número e falar o código."), onError: (error) => toast.error(error.message) },
            )
          }
        >
          Não chegou? Receber por ligação
        </Button>
      </div>
    );
  }

  const hasExisting = status.phones.length > 0 && !isAddingNew;
  return (
    <div className="space-y-3">
      {hasExisting ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Qual número vai disparar?</p>
          {status.phones.map((phone) => (
            <button
              key={phone.id}
              type="button"
              disabled={selectPhone.isPending}
              onClick={() =>
                selectPhone.mutate(
                  { trackingId, phoneNumberId: phone.id },
                  { onSuccess: () => toast.success("Número ligado ao funil!"), onError: (error) => toast.error(error.message) },
                )
              }
              className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-emerald-500")}
            >
              <Phone className="size-4 text-emerald-600" />
              <span className="flex-1 text-sm">
                <strong>{phone.displayNumber}</strong> · {phone.verifiedName ?? "sem nome"}
              </span>
              <span className="text-xs text-muted-foreground">Usar este</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setIsAddingNew(true)}>
            Cadastrar outro número
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Cadastrar o número na Meta (a ÓRBITA faz por você)</p>
          <div className="space-y-1">
            <Label htmlFor="setup-phone">Número com DDD</Label>
            <Input id="setup-phone" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="(11) 91234-5678" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="setup-name">Nome que o cliente vai ver</Label>
            <Input id="setup-name" value={verifiedName} onChange={(event) => setVerifiedName(event.target.value)} placeholder="Nome da sua empresa" />
            <p className="text-[11px] text-muted-foreground">Use o nome da empresa — a Meta revisa e pode recusar nomes genéricos.</p>
          </div>
          <Button onClick={startNew} disabled={phoneNumber.replace(/\D/g, "").length < 10 || verifiedName.trim().length < 2 || addNumber.isPending}>
            {addNumber.isPending && <Loader2 className="size-4 animate-spin" />} Cadastrar e pedir código
          </Button>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={cn("size-4", isFetching && "animate-spin")} /> Conferir conexão
      </Button>
    </div>
  );
}
