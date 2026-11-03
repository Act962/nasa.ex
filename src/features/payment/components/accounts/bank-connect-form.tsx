"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, FileKey2, FileBadge2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BANK_PROVIDERS, normalizePixKey, type BankProviderId } from "../../lib/bank-providers";
import { describePaymentError } from "../../lib/describe-error";
import { useSaveBankConnection } from "../../hooks/use-payment-bank-connections";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";

// Passo a passo para conectar a conta à API do banco (spec 0130, RF-1). Os arquivos são lidos
// no navegador e vão direto para o servidor, que os guarda cifrados.

type Environment = "production" | "sandbox";

interface CredentialFile {
  name: string;
  content: string;
}

export interface BankConnectFormDefaults {
  environment: Environment;
  clientIdLast4: string;
  pixKey: string;
  accountNumber: string | null;
}

interface BankConnectFormProps {
  accountId: string;
  provider: BankProviderId;
  /** Conexão existente: troca de certificado ou de credenciais, mantendo o que não for enviado. */
  existing?: BankConnectFormDefaults;
  onConnected: () => void;
  onCancel?: () => void;
}

const MAX_FILE_BYTES = 20_000;

function detectCredentialKind(content: string): "certificate" | "privateKey" | null {
  if (content.includes("-----BEGIN CERTIFICATE-----")) return "certificate";
  if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(content)) return "privateKey";
  return null;
}

function StepHeader({ number, title, isDone }: { number: number; title: string; isDone: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          isDone ? "bg-success text-white" : "bg-info/15 text-info"
        }`}
      >
        {isDone ? <Check className="size-3.5" /> : number}
      </span>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );
}

export function BankConnectForm({ accountId, provider, existing, onConnected, onCancel }: BankConnectFormProps) {
  const providerInfo = BANK_PROVIDERS[provider];
  const isUpdate = Boolean(existing);
  const [environment, setEnvironment] = useState<Environment>(existing?.environment ?? "production");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [certificate, setCertificate] = useState<CredentialFile | null>(null);
  const [privateKey, setPrivateKey] = useState<CredentialFile | null>(null);
  const [pixKey, setPixKey] = useState(existing?.pixKey ?? "");
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? "");
  const [isAccountNumberOpen, setIsAccountNumberOpen] = useState(Boolean(existing?.accountNumber));
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveConnection = useSaveBankConnection();

  const hasFiles = Boolean(certificate && privateKey) || (isUpdate && !certificate && !privateKey);
  const hasCredentials = isUpdate || (Boolean(clientId.trim()) && Boolean(clientSecret.trim()));
  const canSubmit = hasCredentials && hasFiles && Boolean(pixKey.trim()) && !saveConnection.isPending;
  const normalizedPixKey = normalizePixKey(pixKey);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        toast.error("Extraia o ZIP do banco e envie o .crt e o .key que estão dentro dele.");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} é grande demais para ser um certificado.`);
        continue;
      }
      const content = await file.text();
      const kind = detectCredentialKind(content);
      if (kind === "certificate") setCertificate({ name: file.name, content });
      else if (kind === "privateKey") setPrivateKey({ name: file.name, content });
      else toast.error(`${file.name} não é um certificado nem uma chave em formato PEM (.crt / .key).`);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const { connection } = await saveConnection.mutateAsync({
        accountId,
        provider,
        environment,
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        certificatePem: certificate?.content,
        privateKeyPem: privateKey?.content,
        pixKey: normalizedPixKey,
        accountNumber: accountNumber.trim() || null,
      });
      toast.success(
        connection.status === "ACTIVE"
          ? `${providerInfo.name} conectado. As próximas cobranças saem com PIX de baixa automática.`
          : `${providerInfo.name} conectado. Falta ativar o aviso de pagamento.`,
      );
      emitTourResult({ kind: GUIDE_RESULT_KINDS.bankConnected });
      onConnected();
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível conectar ao banco."));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isUpdate && (
        <section className="space-y-3">
          <StepHeader number={1} title={`Prepare a integração no ${providerInfo.name}`} isDone={false} />
          <ol className="ml-8 list-decimal space-y-1.5 text-sm text-muted-foreground">
            {providerInfo.setupSteps.map((setupStep) => (
              <li key={setupStep}>{setupStep}</li>
            ))}
          </ol>
          <div className="ml-8 flex flex-wrap gap-1.5">
            {providerInfo.requiredScopes.map((scope) => (
              <span key={scope} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {scope}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <StepHeader number={isUpdate ? 1 : 2} title="Credenciais da integração" isDone={hasCredentials && hasFiles} />
        <div className="ml-8 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            {(["production", "sandbox"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEnvironment(option)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  environment === option ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
                }`}
              >
                {option === "production" ? "Conta real" : "Teste (sandbox)"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank-client-id">Client ID</Label>
            <Input
              id="bank-client-id"
              autoComplete="off"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder={existing ? `Em branco mantém o atual (termina em ${existing.clientIdLast4})` : "Ex.: 1a2b3c4d-..."}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank-client-secret">Client Secret</Label>
            <Input
              id="bank-client-secret"
              type="password"
              autoComplete="new-password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              placeholder={isUpdate ? "Deixe em branco para manter o atual" : ""}
            />
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
              isDragging ? "border-info bg-info/5" : "border-border/60 hover:border-info/60"
            }`}
          >
            <Upload className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste o certificado (.crt) e a chave (.key)</p>
            <p className="text-xs text-muted-foreground">
              {isUpdate ? "Só se for trocar o certificado. " : ""}Ou clique para escolher os dois arquivos.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".crt,.key,.pem,.cer,.zip"
              className="hidden"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {(certificate || privateKey) && (
            <div className="space-y-1.5">
              {[
                { file: certificate, label: "Certificado", icon: FileBadge2, clear: () => setCertificate(null) },
                { file: privateKey, label: "Chave", icon: FileKey2, clear: () => setPrivateKey(null) },
              ].map(({ file, label, icon: Icon, clear }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    file ? "border-success/30 bg-success/5" : "border-dashed text-muted-foreground"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${file ? "text-success" : ""}`} />
                  <span className="min-w-0 flex-1 truncate">{file ? file.name : `${label} — falta enviar`}</span>
                  {file && (
                    <button type="button" onClick={clear} aria-label={`Remover ${label.toLowerCase()}`}>
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <StepHeader number={isUpdate ? 2 : 3} title="Chave PIX desta conta" isDone={Boolean(pixKey.trim())} />
        <div className="ml-8 space-y-3">
          <div className="space-y-1.5">
            <Input
              value={pixKey}
              onChange={(event) => setPixKey(event.target.value)}
              placeholder="CNPJ, e-mail, telefone ou chave aleatória"
            />
            <p className="text-xs text-muted-foreground">
              Uma chave que aparece em Pix → Minhas chaves desta conta no {providerInfo.name}.
              {normalizedPixKey && normalizedPixKey !== pixKey.trim() ? ` Vai como ${normalizedPixKey}.` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAccountNumberOpen((isOpen) => !isOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`size-3.5 transition-transform ${isAccountNumberOpen ? "rotate-180" : ""}`} />
            A integração enxerga mais de uma conta?
          </button>
          {isAccountNumberOpen && (
            <div className="space-y-1.5">
              <Label htmlFor="bank-account-number">Número da conta com dígito</Label>
              <Input
                id="bank-account-number"
                inputMode="numeric"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="Ex.: 12345678-9"
              />
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          data-guide={GUIDE_ANCHORS.paymentBankConnectSubmit.id}
          disabled={!canSubmit}
          className="flex-1 gap-2 bg-info text-white hover:bg-info/90">
          {saveConnection.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Testando com o banco...
            </>
          ) : isUpdate ? (
            "Salvar e testar"
          ) : (
            "Conectar e testar"
          )}
        </Button>
      </div>
    </form>
  );
}
