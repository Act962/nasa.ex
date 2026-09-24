"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Instagram,
  KeyRound,
  Loader2,
  PauseCircle,
  Plug,
  PlayCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCommentsChannel,
  useConnectCommentsChannel,
  useDisconnectCommentsChannel,
  useReactivateCommentsChannel,
  useRepairCommentsSubscription,
} from "../hooks/use-comments-channel";

const FIELDS = [
  {
    key: "externalAccountId" as const,
    label: "Instagram Account ID",
    placeholder: "17841400000000000",
    hint: null,
  },
  {
    key: "accessToken" as const,
    label: "Access Token",
    placeholder: "IGQVJ...",
    hint: null,
  },
  {
    key: "appSecret" as const,
    label: "App Secret",
    placeholder: "32 caracteres",
    // A pegadinha que custou um teste inteiro: o app secret que assina o
    // webhook do Instagram não é o de Configurações → Básico.
    hint: "Use o secret de Instagram → Configuração da API, não o de Configurações → Básico.",
  },
  {
    key: "verifyToken" as const,
    label: "Verify Token",
    placeholder: "Você escolhe — o mesmo vai no App da Meta",
    hint: null,
  },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function CredentialsForm({
  initialAccountId = "",
  submitLabel,
  onDone,
}: {
  initialAccountId?: string;
  submitLabel: string;
  onDone?: () => void;
}) {
  const connect = useConnectCommentsChannel();
  const [form, setForm] = useState({
    externalAccountId: initialAccountId,
    accessToken: "",
    appSecret: "",
    verifyToken: "",
  });

  return (
    <div className="space-y-3">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <Input
            value={form[field.key]}
            placeholder={field.placeholder}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                [field.key]: event.target.value,
              }))
            }
          />
          {field.hint && (
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          )}
        </div>
      ))}

      <Button
        className="w-full"
        disabled={connect.isPending}
        onClick={() =>
          connect.mutate(
            { provider: "INSTAGRAM", ...form },
            {
              onSuccess: (result) => {
                if (result.subscribed) {
                  toast.success("Conta conectada e recebendo eventos");
                } else {
                  toast.warning(
                    `Conta conectada, mas a inscrição nos eventos falhou: ${result.subscriptionError ?? "motivo desconhecido"}`,
                  );
                }
                onDone?.();
              },
              onError: (error) => toast.error(error.message),
            },
          )
        }
      >
        {connect.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plug className="size-4" />
        )}
        {submitLabel}
      </Button>
    </div>
  );
}

export function ChannelConnectCard() {
  const { data: channel, isLoading } = useCommentsChannel();
  const disconnect = useDisconnectCommentsChannel();
  const repair = useRepairCommentsSubscription();
  const reactivate = useReactivateCommentsChannel();
  const [isEditingCredentials, setEditingCredentials] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando conexão...
        </CardContent>
      </Card>
    );
  }

  if (channel?.connected) {
    const needsReconnect = channel.status === "NEEDS_RECONNECT";
    const isDisabled = channel.status === "DISABLED";

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Instagram className="size-4" />
            {channel.handle ? `@${channel.handle}` : "Conta conectada"}
            <Badge
              variant={
                needsReconnect
                  ? "destructive"
                  : isDisabled
                    ? "outline"
                    : "secondary"
              }
            >
              {needsReconnect ? "Reconectar" : isDisabled ? "Desativada" : "Ativa"}
            </Badge>
          </CardTitle>
          <CardDescription>
            ID {channel.externalAccountId} · token ••••{channel.accessTokenLast4}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {needsReconnect && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">A Meta recusou a credencial.</p>
                <p className="text-xs text-muted-foreground">
                  {channel.lastErrorMessage ??
                    "Gere um novo token e conecte de novo."}
                </p>
              </div>
            </div>
          )}

          <CopyField label="URL do webhook" value={channel.webhookUrl} />
          <p className="text-xs text-muted-foreground">
            No App da Meta, cole essa URL em Webhooks → Instagram, use o mesmo
            verify token que você informou aqui e assine os campos{" "}
            <code className="font-mono">comments</code> e{" "}
            <code className="font-mono">messages</code>.
          </p>

          {isDisabled && (
            <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <PauseCircle className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Conexão desativada.</p>
                <p className="text-xs text-muted-foreground">
                  As automações e o histórico foram preservados, e a URL do
                  webhook continua a mesma. Reative para voltar a responder.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isDisabled && (
              <Button
                size="sm"
                disabled={reactivate.isPending}
                onClick={() =>
                  reactivate.mutate(
                    { channelId: channel.id },
                    {
                      onSuccess: (result) =>
                        result.subscribed
                          ? toast.success("Conexão reativada")
                          : toast.warning(
                              "Reativada, mas a inscrição nos eventos falhou",
                            ),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                {reactivate.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                Reativar conexão
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={repair.isPending}
              onClick={() =>
                repair.mutate(
                  {},
                  {
                    onSuccess: (result) =>
                      result.subscribed
                        ? toast.success(
                            `Recebendo: ${result.fields.join(", ") || "nenhum campo"}`,
                          )
                        : toast.error(
                            result.error ?? "Não foi possível inscrever",
                          ),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {repair.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Reativar recebimento
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingCredentials((current) => !current)}
            >
              <KeyRound className="size-4" />
              {isEditingCredentials ? "Cancelar" : "Atualizar credenciais"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={disconnect.isPending || isDisabled}
              onClick={() =>
                disconnect.mutate(
                  { channelId: channel.id },
                  {
                    onSuccess: () => toast.success("Conta desconectada"),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <Unplug className="size-4" />
              Desconectar
            </Button>
          </div>

          {isEditingCredentials && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Atualizar mantém a mesma URL de webhook — não precisa mexer na
                Meta de novo.
              </p>
              <CredentialsForm
                initialAccountId={channel.externalAccountId}
                submitLabel="Salvar credenciais"
                onDone={() => setEditingCredentials(false)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="size-4" />
          Conectar Instagram
        </CardTitle>
        <CardDescription>
          Informe as credenciais do seu App da Meta. Conferimos o token antes de
          salvar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CredentialsForm submitLabel="Conectar" />
      </CardContent>
    </Card>
  );
}
