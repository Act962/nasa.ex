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
  useDisconnectCommentsChannel,
  useReactivateCommentsChannel,
  useRepairCommentsSubscription,
} from "../hooks/use-comments-channel";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { InstagramConnectGuideDialog } from "./instagram-connect-guide-dialog";

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

export function ChannelConnectCard() {
  const { data: channel, isLoading } = useCommentsChannel();
  const disconnect = useDisconnectCommentsChannel();
  const repair = useRepairCommentsSubscription();
  const reactivate = useReactivateCommentsChannel();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
              onClick={() => setIsGuideOpen(true)}
            >
              <KeyRound className="size-4" />
              Trocar conta ou credenciais
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

          <InstagramConnectGuideDialog
            open={isGuideOpen}
            onOpenChange={setIsGuideOpen}
            initialAccountId={channel.externalAccountId}
            isStartingAtKeys
          />
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
          Um passo a passo com as telas da Meta: crie o app, pegue as chaves e
          cole aqui. Leva uns 15 minutos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          data-guide={GUIDE_ANCHORS.commentsConnectInstagram.id}
          onClick={() => setIsGuideOpen(true)}
        >
          <Instagram className="size-4" />
          Conectar Instagram passo a passo
        </Button>
        <InstagramConnectGuideDialog
          open={isGuideOpen}
          onOpenChange={setIsGuideOpen}
        />
      </CardContent>
    </Card>
  );
}
