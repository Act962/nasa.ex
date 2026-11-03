"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BANK_PROVIDERS, type BankProviderId } from "../../lib/bank-providers";
import { describePaymentError } from "../../lib/describe-error";
import {
  useDisconnectBankConnection,
  useSetChargeBankConnection,
  useTestBankConnection,
} from "../../hooks/use-payment-bank-connections";
import { BankConnectForm } from "./bank-connect-form";
import { BankConnectionStatusBadge, daysUntil, type BankConnectionStatus } from "./bank-connection-status";

// Painel da conexão de uma conta com a API do banco (spec 0130): conectar, ver o estado,
// escolher se gera o PIX das cobranças, testar, trocar o certificado e desconectar.

export interface BankConnectionView {
  id: string;
  provider: BankProviderId;
  environment: "production" | "sandbox";
  clientIdLast4: string;
  certificateValidTo: Date | null;
  scopes: string[];
  moneyMovingScopes: string[];
  pixKey: string;
  accountNumber: string | null;
  isDefaultForCharges: boolean;
  webhookRegisteredAt: Date | null;
  lastErrorMessage: string | null;
  status: BankConnectionStatus;
}

export interface BankConnectionAccount {
  id: string;
  name: string;
  bankConnection?: BankConnectionView | null;
}

interface BankConnectionSheetProps {
  account: BankConnectionAccount | null;
  provider: BankProviderId;
  onClose: () => void;
}

const CERTIFICATE_WARNING_DAYS = 90;

function InfoRow({ icon: Icon, label, children }: { icon: typeof Zap; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function ConnectedPanel({
  connection,
  onReplaceCredentials,
  onDisconnected,
}: {
  connection: BankConnectionView;
  onReplaceCredentials: () => void;
  onDisconnected: () => void;
}) {
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
  const testConnection = useTestBankConnection();
  const setChargeConnection = useSetChargeBankConnection();
  const disconnect = useDisconnectBankConnection();
  const certificateDaysLeft = connection.certificateValidTo ? daysUntil(connection.certificateValidTo) : null;

  async function handleTest() {
    try {
      const { connection: tested } = await testConnection.mutateAsync({ connectionId: connection.id });
      toast.success(tested.status === "ACTIVE" ? "Conexão funcionando." : "O banco respondeu, mas falta ativar o aviso de pagamento.");
    } catch (error) {
      toast.error(describePaymentError(error, "O banco não respondeu."));
    }
  }

  async function handleChargeToggle(isDefaultForCharges: boolean) {
    try {
      await setChargeConnection.mutateAsync({ connectionId: connection.id, isDefaultForCharges });
      toast.success(
        isDefaultForCharges
          ? "As cobranças passam a sair com o PIX desta conta."
          : "As cobranças voltam ao PIX com a chave da empresa, sem baixa automática.",
      );
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível mudar."));
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync({ connectionId: connection.id });
      toast.success("Banco desconectado. As cobranças voltam ao PIX com a chave da empresa.");
      setIsConfirmingDisconnect(false);
      onDisconnected();
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível desconectar."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <BankConnectionStatusBadge provider={connection.provider} status={connection.status} />
          {connection.environment === "sandbox" && (
            <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs text-warning">Teste (sandbox)</span>
          )}
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="font-medium">Gerar o PIX das cobranças por esta conta</span>
            <span className="block text-xs text-muted-foreground">
              A régua e a página da cobrança usam o PIX do banco, e a conta é baixada sozinha quando o cliente paga.
            </span>
          </span>
          <Switch
            checked={connection.isDefaultForCharges}
            disabled={setChargeConnection.isPending}
            onCheckedChange={(isChecked) => void handleChargeToggle(isChecked)}
          />
        </label>
      </div>

      {connection.moneyMovingScopes.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            A integração no banco permite tirar dinheiro da conta ({connection.moneyMovingScopes.join(", ")}). O ÓRBITA não
            usa essas permissões: peça ao banco para removê-las.
          </p>
        </div>
      )}

      <div className="divide-y rounded-xl border px-4">
        <InfoRow icon={Zap} label="Baixa automática">
          {connection.webhookRegisteredAt ? (
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-4" /> Ativa: o banco avisa quando o PIX é pago
            </span>
          ) : (
            <div className="space-y-2">
              <p className="text-warning">Pendente: o PIX sai do banco, mas a baixa ainda é manual.</p>
              {connection.lastErrorMessage && (
                <p className="text-xs text-muted-foreground">{connection.lastErrorMessage}</p>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" disabled={testConnection.isPending} onClick={() => void handleTest()}>
                <RefreshCw className="size-3.5" /> Tentar ativar de novo
              </Button>
            </div>
          )}
        </InfoRow>
        {connection.webhookRegisteredAt && connection.lastErrorMessage && (
          <InfoRow icon={TriangleAlert} label="Último problema">
            <span className="text-destructive">{connection.lastErrorMessage}</span>
          </InfoRow>
        )}
        <InfoRow icon={CalendarClock} label="Certificado">
          {connection.certificateValidTo && certificateDaysLeft !== null ? (
            <span className={certificateDaysLeft <= CERTIFICATE_WARNING_DAYS ? "text-warning" : ""}>
              {certificateDaysLeft <= 0
                ? "Vencido — troque para voltar a baixa automática"
                : `Vale até ${new Date(connection.certificateValidTo).toLocaleDateString("pt-BR")} (${certificateDaysLeft} dias)`}
            </span>
          ) : (
            "—"
          )}
        </InfoRow>
        <InfoRow icon={KeyRound} label="Chave PIX e integração">
          <span className="break-all">{connection.pixKey}</span>
          <span className="block text-xs text-muted-foreground">Client ID terminado em {connection.clientIdLast4}</span>
        </InfoRow>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-1.5" disabled={testConnection.isPending} onClick={() => void handleTest()}>
          {testConnection.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Testar conexão
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onReplaceCredentials}>
          <KeyRound className="size-4" /> Trocar certificado
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setIsConfirmingDisconnect(true)}
      >
        <Unplug className="size-4" /> Desconectar banco
      </Button>

      <ConfirmDialog
        isOpen={isConfirmingDisconnect}
        title="Desconectar o banco?"
        description="As credenciais são apagadas e as cobranças voltam ao PIX com a chave da empresa, sem baixa automática. Os PIX do banco ainda em aberto são cancelados: quem tiver o copia e cola antigo paga pelo link da cobrança."
        confirmText="Desconectar"
        isDangerous
        isLoading={disconnect.isPending}
        onConfirm={handleDisconnect}
        onCancel={() => setIsConfirmingDisconnect(false)}
      />
    </div>
  );
}

export function BankConnectionSheet({ account, provider, onClose }: BankConnectionSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const connection = account?.bankConnection ?? null;
  const providerInfo = BANK_PROVIDERS[connection?.provider ?? provider];

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) return;
    setIsEditing(false);
    onClose();
  }

  return (
    <Sheet open={Boolean(account)} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{connection ? `${providerInfo.name} conectado` : `Conectar ao ${providerInfo.name}`}</SheetTitle>
          <SheetDescription>
            {account?.name}. {connection
              ? "Cada cobrança ganha um PIX próprio do banco, e a conta é baixada sozinha quando o cliente paga."
              : "Cada cobrança passa a ter um PIX próprio do banco, e a conta é baixada sozinha quando o cliente paga. Leva uns 5 minutos."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {account && connection && !isEditing && (
            <ConnectedPanel
              connection={connection}
              onReplaceCredentials={() => setIsEditing(true)}
              onDisconnected={() => handleOpenChange(false)}
            />
          )}
          {account && (!connection || isEditing) && (
            <BankConnectForm
              accountId={account.id}
              provider={connection?.provider ?? provider}
              existing={
                connection
                  ? {
                      environment: connection.environment,
                      clientIdLast4: connection.clientIdLast4,
                      pixKey: connection.pixKey,
                      accountNumber: connection.accountNumber,
                    }
                  : undefined
              }
              onConnected={() => setIsEditing(false)}
              onCancel={connection ? () => setIsEditing(false) : undefined}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
