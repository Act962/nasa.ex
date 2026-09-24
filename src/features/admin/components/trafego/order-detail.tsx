"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Download,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  TrafegoOrderStatus,
  TrafegoTransitionSource,
} from "@/generated/prisma/enums";
import {
  useLinkTrafegoBroadcast,
  useLinkTrafegoMetaCampaign,
  useReplyTrafegoMessage,
  useTrafegoAdminMessages,
  useTrafegoAdminOrder,
  useUnlinkTrafegoMetaCampaign,
  useUpdateTrafegoOrderStatus,
} from "@/features/trafego/hooks/use-trafego-admin";
import { ORDER_STATUS_LABEL } from "@/features/trafego/lib/order-status";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  META_OBJECTIVE,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { OrderStatusBadge } from "@/features/trafego/components/panel/order-status-badge";
import { useAdminPath } from "@/features/trafego/lib/base-path";

const SOURCE_LABEL: Record<TrafegoTransitionSource, string> = {
  KANBAN: "kanban",
  ADMIN: "admin",
  CLIENT: "cliente",
  SYSTEM: "sistema",
};

export function TrafegoOrderAdminDetail({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = useTrafegoAdminOrder(orderId);
  const adminPath = useAdminPath();
  const updateStatus = useUpdateTrafegoOrderStatus();
  const linkMeta = useLinkTrafegoMetaCampaign();
  const linkBroadcast = useLinkTrafegoBroadcast();
  const unlinkMeta = useUnlinkTrafegoMetaCampaign();

  const [clientNote, setClientNote] = useState("");
  const [metaCampaignId, setMetaCampaignId] = useState("");
  const [broadcastId, setBroadcastId] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando pedido…
      </div>
    );
  }
  if (!order) {
    return <div className="p-20 text-center text-sm">Pedido não encontrado.</div>;
  }

  function handleStatusChange(nextStatus: string) {
    updateStatus.mutate(
      {
        orderId,
        status: nextStatus as TrafegoOrderStatus,
        clientNote: clientNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setClientNote("");
          toast.success("Status atualizado — o cliente já vê a mudança.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="p-6">
      <Link
        href={adminPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <h1 className="mt-1.5 text-xl font-bold">
            {order.businessName ?? order.organization.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.owner.name} · {order.owner.email}
            {order.owner.phone ? ` · ${order.owner.phone}` : ""}
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">
            {formatBrlFromCents(order.totalBrlCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            Verba {formatBrlFromCents(order.adBudgetBrlCents)} · Serviço{" "}
            {formatBrlFromCents(order.serviceFeeBrlCents)}
          </p>
        </div>
      </div>

      {order.pendingPurchase?.amountMismatch && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Valor cobrado diverge do plano</p>
            <p className="text-xs text-muted-foreground">
              O Stripe cobrou{" "}
              {formatBrlFromCents(order.pendingPurchase.amountBrlCents)} para um plano
              de {formatBrlFromCents(order.totalBrlCents)}. Confira antes de definir a
              verba real da campanha.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue="materiais">
          <TabsList>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="briefing">Briefing</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="conversa">Conversa</TabsTrigger>
          </TabsList>

          <TabsContent value="materiais" className="mt-5 space-y-6">
            <section>
              <h3 className="text-sm font-semibold">
                Criativos ({order.creatives.length})
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {order.creatives.map((creative) => (
                  <div key={creative.id} className="overflow-hidden rounded-lg border">
                    <div className="aspect-video bg-muted">
                      {creative.kind === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={creative.url}
                          alt={creative.fileName ?? ""}
                          className="size-full object-cover"
                        />
                      ) : (
                        <video src={creative.url} controls className="size-full" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {creative.fileName ?? "Arquivo"}
                      </span>
                      <a
                        href={creative.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-muted-foreground hover:text-foreground"
                      >
                        <Download className="size-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
                {order.creatives.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Cliente ainda não enviou criativos.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold">Copies ({order.copies.length})</h3>
              <div className="mt-3 space-y-2">
                {order.copies.map((copy) => (
                  <div
                    key={copy.id}
                    className={`rounded-lg border p-3 ${copy.isSelected ? "border-primary/50 bg-primary/5" : ""}`}
                  >
                    {copy.headline && (
                      <p className="text-sm font-medium">{copy.headline}</p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {copy.primaryText}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {copy.callToAction && <span>Botão: {copy.callToAction}</span>}
                      {copy.isSelected && (
                        <span className="font-medium text-primary">✓ Selecionada</span>
                      )}
                    </div>
                  </div>
                ))}
                {order.copies.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Cliente ainda não escreveu copies.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="briefing" className="mt-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Canal" value={PLATFORM_SHORT_LABEL[order.platform]} />
              <Info
                label="Tipo"
                value={CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]}
              />
              <Info
                label="Objetivo"
                value={`${OBJECTIVE_LABEL[order.objective]}${
                  META_OBJECTIVE[order.objective]
                    ? ` (${META_OBJECTIVE[order.objective]})`
                    : ""
                }`}
              />
              <Info label="Duração" value={`${order.durationDays} dias`} />
              <Info label="Ramo" value={order.businessNiche} />
              <Info label="WhatsApp" value={order.whatsappNumber} />
              <Info label="Destino" value={order.destinationUrl} isLink />
              <Info label="Público-alvo" value={order.targetAudience} wide />
              <Info label="Observações" value={order.notes} wide />
            </dl>
          </TabsContent>

          <TabsContent value="historico" className="mt-5">
            <ol className="space-y-4 border-l pl-4">
              {order.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1 size-2.5 rounded-full ${
                      event.isClientVisible ? "bg-primary" : "bg-muted-foreground"
                    }`}
                  />
                  <p className="text-sm font-medium">
                    {event.title}
                    {!event.isClientVisible && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (interno)
                      </span>
                    )}
                    {event.source && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {SOURCE_LABEL[event.source]}
                      </span>
                    )}
                  </p>
                  {event.detail && (
                    <p className="text-sm text-muted-foreground">{event.detail}</p>
                  )}
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("pt-BR")}
                  </time>
                  {event.clientNotifiedAt && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                      <BellRing className="size-3" /> cliente avisado
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="conversa" className="mt-5">
            <AdminSupportThread orderId={orderId} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-5">
          {order.leadId && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Card no tracking</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Arrastar o card muda a fase do pedido e avisa o cliente — o comprovante e as
                conversas ficam nele.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href={`/contatos/${order.leadId}`} target="_blank">
                  <ExternalLink className="mr-1.5 size-4" />
                  Abrir card
                </Link>
              </Button>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Mudar status</h3>
            <Textarea
              value={clientNote}
              onChange={(event) => setClientNote(event.target.value)}
              placeholder="Recado para o cliente (opcional) — aparece na timeline dele"
              rows={3}
              className="mt-3"
            />
            <Select value={order.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="mt-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {updateStatus.isPending && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Salvando…
              </p>
            )}
          </div>

          {order.platform === "META_ADS" ? (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Vincular campanha do Meta</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cole o ID da campanha para o cliente ver os números reais.
              </p>
              <Label className="mt-3 block text-xs">ID da campanha</Label>
              <Input
                value={metaCampaignId || order.metaCampaignExternalId || ""}
                onChange={(event) => setMetaCampaignId(event.target.value)}
                placeholder="1203...."
                className="mt-1"
              />
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={linkMeta.isPending}
                onClick={() =>
                  linkMeta.mutate(
                    {
                      orderId,
                      metaCampaignExternalId: metaCampaignId.trim() || null,
                    },
                    {
                      onSuccess: () => toast.success("Campanha vinculada."),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                <Link2 className="mr-1.5 size-4" />
                Vincular
              </Button>
              {order.metaCampaignExternalId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full"
                  disabled={unlinkMeta.isPending}
                  onClick={() =>
                    unlinkMeta.mutate(
                      { orderId },
                      {
                        onSuccess: () => {
                          setMetaCampaignId("");
                          toast.success("Campanha desvinculada.");
                        },
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                >
                  <Link2Off className="mr-1.5 size-4" />
                  Desvincular
                </Button>
              )}
              {order.metaAutoLinkedAt && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald-600">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  Vinculada automaticamente pelo código no nome, em{" "}
                  {new Date(order.metaAutoLinkedAt).toLocaleDateString("pt-BR")}.
                </p>
              )}
              {order.metricsOrganizationId && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Métricas lidas da organização da agência.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Vincular disparo</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie o disparo no app Campanhas e cole o ID aqui.
              </p>
              <Label className="mt-3 block text-xs">ID do broadcast</Label>
              <Input
                value={broadcastId || order.broadcastId || ""}
                onChange={(event) => setBroadcastId(event.target.value)}
                placeholder="cly…"
                className="mt-1"
              />
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={linkBroadcast.isPending}
                onClick={() =>
                  linkBroadcast.mutate(
                    { orderId, broadcastId: broadcastId.trim() || null },
                    {
                      onSuccess: () => toast.success("Disparo vinculado."),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                <Link2 className="mr-1.5 size-4" />
                Vincular
              </Button>
              <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                <Link href="/campanhas" target="_blank">
                  <ExternalLink className="mr-1.5 size-4" />
                  Abrir Campanhas
                </Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  wide,
  isLink,
}: {
  label: string;
  value: string | null;
  wide?: boolean;
  isLink?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          isLink ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {value}
            </a>
          ) : (
            <span className="whitespace-pre-wrap">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function AdminSupportThread({ orderId }: { orderId: string }) {
  const [draft, setDraft] = useState("");
  const { data: messages } = useTrafegoAdminMessages(orderId, {
    refetchInterval: 20_000,
  });
  const reply = useReplyTrafegoMessage(orderId);

  return (
    <div>
      <div className="space-y-3">
        {messages?.map((message) => {
          const isTeam = message.authorRole === "ÓRBITA";
          return (
            <div
              key={message.id}
              className={`flex ${isTeam ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  isTeam ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <p className="text-xs font-medium opacity-70">
                  {message.author.name ?? (isTeam ? "Equipe" : "Cliente")}
                </p>
                <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                <time className="mt-1 block text-[10px] opacity-70">
                  {new Date(message.createdAt).toLocaleString("pt-BR")}
                </time>
              </div>
            </div>
          );
        })}
        {(!messages || messages.length === 0) && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem nesta campanha.
          </p>
        )}
      </div>

      <div className="mt-4 border-t pt-4">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Responder ao cliente…"
          rows={3}
        />
        <Button
          size="sm"
          className="mt-2"
          disabled={!draft.trim() || reply.isPending}
          onClick={() =>
            reply.mutate(
              { orderId, body: draft.trim() },
              {
                onSuccess: () => setDraft(""),
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          {reply.isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 size-4" />
          )}
          Enviar
        </Button>
      </div>
    </div>
  );
}
