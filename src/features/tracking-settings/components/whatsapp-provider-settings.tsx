"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, ShieldCheck, ExternalLink, BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  useWhatsAppProviderSettings,
  useUpdateWhatsAppProviderSettings,
  useMetaPhoneStatus,
} from "../hooks/use-whatsapp-provider";
import { WhatsAppEmbeddedSignupButton } from "./whatsapp-embedded-signup-button";

/**
 * Fase 4 — Seletor de provider WhatsApp + form de credenciais Meta.
 *
 * Aparece dentro do `chat-settings` quando o tracking já tem uma
 * `WhatsAppInstance` (na Fase 4 não criamos provider sem instância
 * Uazapi base — o tracking SEMPRE começa Uazapi). O cliente pode
 * promover pra `META_CLOUD` aqui, mas a Fase 5/6 é que vai conectar
 * o envio/recebimento. Nesta fase, a UI apenas grava as credenciais
 * cifradas no banco — sem efeito operacional ainda.
 *
 * Segurança:
 *  - Server retorna só máscara (`hasX` + `lastX`).
 *  - Inputs começam vazios e mostram um placeholder "•••• <last4>"
 *    quando o segredo já está gravado, pra operador conferir QUAL
 *    valor está lá sem o segredo voltar pra rede.
 *  - Campos vazios no submit = "não tocar" (não limpa o segredo).
 *  - Botão "Remover" explicito pra zerar todos os segredos.
 */
type ProviderId = "UAZAPI" | "META_CLOUD";

interface MetaFormState {
  accessToken: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  businessAccountId: string;
}

const EMPTY_META: MetaFormState = {
  accessToken: "",
  phoneNumberId: "",
  appSecret: "",
  verifyToken: "",
  businessAccountId: "",
};

export function WhatsAppProviderSettings({
  trackingId,
}: {
  trackingId: string;
}) {
  const { data, isLoading } = useWhatsAppProviderSettings(trackingId);
  const updateMutation = useUpdateWhatsAppProviderSettings(trackingId);
  // Status real do número via Graph API — só busca quando o provider
  // armazenado é META_CLOUD (evita chamada desnecessária pra Uazapi).
  const { data: phoneStatus } = useMetaPhoneStatus(
    trackingId,
    data?.provider === "META_CLOUD",
  );

  // Mesmo gate do WhatsAppEmbeddedSignupButton — quando false, o botão
  // retorna null. Replicamos aqui só pra decidir mostrar o divisor "ou".
  const hasEmbeddedSignupConfigured = Boolean(
    process.env.NEXT_PUBLIC_META_APP_ID &&
      process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID,
  );

  const [selectedProvider, setSelectedProvider] =
    useState<ProviderId>("UAZAPI");
  const [metaForm, setMetaForm] = useState<MetaFormState>(EMPTY_META);

  // Sincroniza estado local com server quando carrega.
  useEffect(() => {
    if (data?.provider) {
      setSelectedProvider(data.provider as ProviderId);
    }
  }, [data?.provider]);

  // Resumo do que está gravado (vindo da máscara).
  const metaSummary = data?.meta;
  const hasAnyMetaCredential = useMemo(
    () =>
      Boolean(
        metaSummary?.hasAccessToken ||
          metaSummary?.phoneNumberId ||
          metaSummary?.hasAppSecret ||
          metaSummary?.hasVerifyToken,
      ),
    [metaSummary],
  );

  // Gate UI (Fase 5 → atualizado na Fase 7.3): ativar META_CLOUD exige
  // apenas `Access Token` + `Phone Number ID` por instância. `App Secret`
  // e `Verify Token` viraram opcionais — quando vazios, o webhook usa o
  // env global (`META_APP_SECRET` / `META_VERIFY_TOKEN_GLOBAL`) do App
  // único da NASA. Preenchidos, têm prioridade (Fase 4 backward compat).
  const metaMissing = useMemo(() => {
    if (selectedProvider !== "META_CLOUD") return [] as string[];
    const missing: string[] = [];
    const willHaveAccessToken =
      Boolean(metaForm.accessToken) || Boolean(metaSummary?.hasAccessToken);
    const willHavePhoneNumberId =
      Boolean(metaForm.phoneNumberId) || Boolean(metaSummary?.phoneNumberId);
    if (!willHaveAccessToken) missing.push("Access Token");
    if (!willHavePhoneNumberId) missing.push("Phone Number ID");
    return missing;
  }, [selectedProvider, metaForm, metaSummary]);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    // Sem instância ainda — nada pra configurar.
    return null;
  }

  const handleSave = () => {
    const payload: {
      trackingId: string;
      provider: ProviderId;
      meta?: Partial<MetaFormState>;
    } = {
      trackingId,
      provider: selectedProvider,
    };
    if (selectedProvider === "META_CLOUD") {
      // Só envia campos que o operador preencheu — campos vazios
      // significam "não tocar" (UI explicada acima).
      const metaPatch: Partial<MetaFormState> = {};
      if (metaForm.accessToken) metaPatch.accessToken = metaForm.accessToken;
      if (metaForm.phoneNumberId)
        metaPatch.phoneNumberId = metaForm.phoneNumberId;
      if (metaForm.appSecret) metaPatch.appSecret = metaForm.appSecret;
      if (metaForm.verifyToken) metaPatch.verifyToken = metaForm.verifyToken;
      if (metaForm.businessAccountId)
        metaPatch.businessAccountId = metaForm.businessAccountId;
      if (Object.keys(metaPatch).length > 0) {
        payload.meta = metaPatch;
      }
    }
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setMetaForm(EMPTY_META);
      },
    });
  };

  const handleClearMetaCredentials = () => {
    if (
      !confirm(
        "Tem certeza? Isso apaga as credenciais Meta gravadas (provider segue como está).",
      )
    ) {
      return;
    }
    updateMutation.mutate(
      {
        trackingId,
        meta: {
          accessToken: null,
          phoneNumberId: null,
          appSecret: null,
          verifyToken: null,
          businessAccountId: null,
        },
      },
      {
        onSuccess: () => setMetaForm(EMPTY_META),
      },
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          Provider WhatsApp
          <Badge variant="outline" className="text-[10px] uppercase">
            {data.provider === "META_CLOUD" ? "Oficial Meta" : "Uazapi"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha qual API responde pelo WhatsApp deste tracking. A troca
          não afeta envios em andamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status real do número Meta (Fase 7.5). On-demand via Graph API. */}
        {phoneStatus && (
          <MetaPhoneStatusCard
            displayPhoneNumber={phoneStatus.displayPhoneNumber}
            verifiedName={phoneStatus.verifiedName}
            qualityRating={phoneStatus.qualityRating}
            codeVerificationStatus={phoneStatus.codeVerificationStatus}
            messagingLimitTier={phoneStatus.messagingLimitTier}
          />
        )}

        {data.provider === "META_CLOUD" && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/tracking/${trackingId}/whatsapp-analytics`}>
              <BarChart3Icon className="size-3.5" />
              Ver Analytics do WhatsApp
            </Link>
          </Button>
        )}

        <RadioGroup
          value={selectedProvider}
          onValueChange={(value) =>
            setSelectedProvider(value as ProviderId)
          }
          className="grid gap-3"
        >
          <ProviderOption
            id="provider-uazapi"
            value="UAZAPI"
            title="Uazapi (não-oficial)"
            description="O que você já usa hoje. QR Code + número pessoal/business. Sem template HSM, mas com risco de ban da Meta."
            selected={selectedProvider === "UAZAPI"}
          />
          <ProviderOption
            id="provider-meta-cloud"
            value="META_CLOUD"
            title="Meta Cloud API (oficial)"
            description="API oficial do WhatsApp Business. Exige número aprovado no Meta App + template HSM pra mensagens fora da janela de 24h."
            selected={selectedProvider === "META_CLOUD"}
          />
        </RadioGroup>

        {selectedProvider === "META_CLOUD" && (
          <div className="space-y-4">
            {/*
             * Caminho rápido: Embedded Signup (Fase 7). Esconde por
             * presença das envs públicas; sem elas, o componente retorna
             * null e só o form manual aparece.
             */}
            <WhatsAppEmbeddedSignupButton trackingId={trackingId} />

            {/* Divisor visual quando os dois caminhos coexistem. */}
            {hasEmbeddedSignupConfigured && (
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    ou configure manualmente
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Lock className="size-3.5" />
                    Credenciais Meta Cloud API (manual)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Útil pra cliente white-label com App Meta próprio ou
                    quando o fluxo OAuth não está disponível. Credenciais
                    em{" "}
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    developers.facebook.com/apps
                    <ExternalLink className="size-3" />
                  </a>
                  . Tudo é cifrado antes de gravar (AES-256-GCM).
                </p>
              </div>
              {hasAnyMetaCredential && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMetaCredentials}
                  disabled={updateMutation.isPending}
                  className="text-destructive shrink-0"
                >
                  Remover
                </Button>
              )}
            </div>

            <CredentialField
              label="Access Token (System User long-lived)"
              placeholder={placeholderFor(
                metaSummary?.hasAccessToken,
                metaSummary?.lastAccessToken,
                "Cole o token aqui",
              )}
              value={metaForm.accessToken}
              onChange={(value) =>
                setMetaForm((state) => ({ ...state, accessToken: value }))
              }
              type="password"
            />
            <CredentialField
              label="Phone Number ID"
              placeholder={publicIdPlaceholder(
                metaSummary?.phoneNumberId,
                "Ex.: 1098765432109876",
              )}
              value={metaForm.phoneNumberId}
              onChange={(value) =>
                setMetaForm((state) => ({ ...state, phoneNumberId: value }))
              }
            />
            <CredentialField
              label="App Secret"
              placeholder={placeholderFor(
                metaSummary?.hasAppSecret,
                metaSummary?.lastAppSecret,
                "Da página App Settings → Basic",
              )}
              value={metaForm.appSecret}
              onChange={(value) =>
                setMetaForm((state) => ({ ...state, appSecret: value }))
              }
              type="password"
            />
            <CredentialField
              label="Verify Token (hub.verify_token do webhook)"
              placeholder={placeholderFor(
                metaSummary?.hasVerifyToken,
                metaSummary?.lastVerifyToken,
                "Qualquer string que você definiu no webhook",
              )}
              value={metaForm.verifyToken}
              onChange={(value) =>
                setMetaForm((state) => ({ ...state, verifyToken: value }))
              }
            />
            <CredentialField
              label="WhatsApp Business Account ID (opcional)"
              placeholder={publicIdPlaceholder(
                metaSummary?.businessAccountId,
                "Necessário pra templates",
              )}
              value={metaForm.businessAccountId}
              onChange={(value) =>
                setMetaForm((state) => ({
                  ...state,
                  businessAccountId: value,
                }))
              }
            />

            <Alert>
              <AlertTitle className="text-xs">
                Recebimento ativo
              </AlertTitle>
              <AlertDescription className="text-xs">
                Com as 4 credenciais obrigatórias gravadas e o webhook
                configurado no Meta App apontando pra{" "}
                <code>/api/chat/webhook/official</code>, mensagens
                inbound já criam Lead/Conversation/Message via o mesmo
                pipeline canônico do Uazapi.
              </AlertDescription>
            </Alert>

            {metaMissing.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle className="text-xs">
                  Credenciais incompletas
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Pra salvar com provider Meta Cloud API, preencha:{" "}
                  {metaMissing.join(", ")}. Sem essas o webhook oficial
                  não consegue receber mensagens.
                </AlertDescription>
              </Alert>
            )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || metaMissing.length > 0}
            size="sm"
          >
            {updateMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderOption({
  id,
  value,
  title,
  description,
  selected,
}: {
  id: string;
  value: ProviderId;
  title: string;
  description: string;
  selected: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={
        "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors " +
        (selected
          ? "border-primary bg-primary/5"
          : "border-border/50 hover:bg-muted/30")
      }
    >
      <RadioGroupItem id={id} value={value} className="mt-1" />
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Label>
  );
}

function CredentialField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete="off"
      />
    </div>
  );
}

function placeholderFor(
  hasValue: boolean | undefined,
  last: string | null | undefined,
  fallback: string,
): string {
  if (hasValue) {
    return last ? `•••• ${last} (deixe vazio para manter)` : "•••• (gravado)";
  }
  return fallback;
}

/**
 * Placeholder pros identificadores PÚBLICOS (`phoneNumberId`,
 * `businessAccountId`). Mostra valor inteiro — não tem o que mascarar,
 * são públicos (aparecem em todo webhook Meta).
 */
function publicIdPlaceholder(
  current: string | null | undefined,
  fallback: string,
): string {
  return current ? `${current} (deixe vazio para manter)` : fallback;
}

function MetaPhoneStatusCard({
  displayPhoneNumber,
  verifiedName,
  qualityRating,
  codeVerificationStatus,
  messagingLimitTier,
}: {
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
  messagingLimitTier: string | null;
}) {
  const qualityColor =
    qualityRating === "GREEN"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
      : qualityRating === "YELLOW"
        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
        : qualityRating === "RED"
          ? "bg-red-500/10 text-red-700 border-red-500/30"
          : "bg-muted text-muted-foreground border-border/50";

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{verifiedName}</h4>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {displayPhoneNumber}
          </p>
        </div>
        {qualityRating && (
          <Badge
            variant="outline"
            className={`text-[10px] uppercase ${qualityColor}`}
          >
            {qualityRating}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {codeVerificationStatus && (
          <div>
            <span className="text-muted-foreground">Verificação: </span>
            <span className="font-medium">{codeVerificationStatus}</span>
          </div>
        )}
        {messagingLimitTier && (
          <div>
            <span className="text-muted-foreground">Limite: </span>
            <span className="font-medium">
              {messagingLimitTier.replace("TIER_", "")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
