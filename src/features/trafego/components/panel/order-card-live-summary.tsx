"use client";

import { AlertTriangle, ImageOff } from "lucide-react";
import { useTrafegoOrderAds } from "@/features/trafego/hooks/use-trafego-performance";
import { formatMoneyFromCents } from "./account-performance-sections";
import { DeliveryToggle } from "./delivery-toggle";
import { QualityScoreBadge } from "./quality/quality-score-badge";
import { IndicatorPopover } from "./quality/indicator-popover";
import { AdOriginLine } from "./quality/ad-origin-line";

/**
 * Visão rápida da campanha no ar no cartão da lista: cada anúncio com o próprio
 * liga/desliga e os quatro números que o cliente pergunta primeiro. Só para campanha
 * no ar ou pausada, para não ler a Meta por pedido encerrado (cache de 15 min).
 */

const MAX_AD_ROWS = 3;

type OrderAdsResult = NonNullable<ReturnType<typeof useOrderCardAds>>;
type OrderAd = OrderAdsResult["ads"][number];

export function useOrderCardAds(orderId: string, isEnabled: boolean) {
  const { data } = useTrafegoOrderAds(orderId, "order", { enabled: isEnabled });
  return data?.mode === "account" ? data : null;
}

/** Quando a Meta não responde, o cartão diz o motivo em vez de sumir com conjunto e anúncios em silêncio. */
export function useOrderCardAdsProblem(orderId: string, isEnabled: boolean): string | null {
  const { data, isError } = useTrafegoOrderAds(orderId, "order", { enabled: isEnabled });
  if (isError) return "Não conseguimos ler a Meta agora.";
  return data?.mode === "unavailable" ? data.message : null;
}

export function OrderCardAdsProblem({ message }: { message: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-xs text-warning">
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      {message} Os anúncios aparecem aqui quando a conexão voltar.
    </p>
  );
}

/** Conjunto único do pedido, para o título do cartão com o liga/desliga dele. */
export function resolveSingleAdset(ads: OrderAd[]): { id: string; name: string; isActive: boolean } | null {
  const adsetIds = [...new Set(ads.map((ad) => ad.adsetId))];
  if (adsetIds.length !== 1) return null;
  const firstAd = ads[0];
  return { id: firstAd.adsetId, name: firstAd.adsetName ?? "Conjunto de anúncios", isActive: firstAd.adsetStatus === "ACTIVE" };
}

export function OrderCardCampaignsCount({ campaignsCount }: { campaignsCount: number }) {
  if (campaignsCount === 0) return null;
  return (
    <p className="mt-1 text-xs font-medium text-success">
      {campaignsCount === 1 ? "1 campanha" : `${campaignsCount} campanhas`}
    </p>
  );
}

function AdThumbnail({ ad }: { ad: OrderAd }) {
  if (!ad.previewUrl) {
    return (
      <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground">
        <ImageOff className="size-4" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- prévia vem do CDN da Meta, sem domínio fixo
  return <img src={ad.previewUrl} alt={`Criativo ${ad.name}`} className="size-10 shrink-0 rounded-[10px] object-cover" />;
}

export function OrderCardAdRows({
  orderId,
  ads,
  currency,
  canEdit,
  isQualityScoreVisible,
}: {
  orderId: string;
  ads: OrderAd[];
  currency: string;
  canEdit: boolean;
  isQualityScoreVisible: boolean;
}) {
  if (ads.length === 0) return null;
  const visibleAds = ads.slice(0, MAX_AD_ROWS);
  const hiddenCount = ads.length - visibleAds.length;
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {visibleAds.map((ad) => {
        const stats = [
          { key: "conversations", label: "Conversas", value: ad.metrics.conversations.toLocaleString("pt-BR") },
          { key: "spendCents", label: "Investido", value: formatMoneyFromCents(ad.metrics.spendCents, currency) },
          { key: "clicks", label: "Cliques", value: ad.metrics.clicks.toLocaleString("pt-BR") },
          {
            key: "costPerConversationCents",
            label: "Custo/conversa",
            value:
              ad.metrics.conversations > 0 ? formatMoneyFromCents(ad.metrics.costPerConversationCents, currency) : "—",
          },
        ] as const;
        return (
          <div key={ad.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <DeliveryToggle
                orderId={orderId}
                objectType="ad"
                objectId={ad.id}
                objectName={ad.name}
                isActive={ad.configuredStatus === "ACTIVE"}
                canEdit={canEdit}
              />
              <AdThumbnail ad={ad} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Anúncio
                  {isQualityScoreVisible && <QualityScoreBadge quality={ad.quality} />}
                </p>
                <p className="line-clamp-2 text-sm font-medium">{ad.name}</p>
                <AdOriginLine
                  initialMessage={ad.initialMessage}
                  leadOrigin={ad.leadOrigin}
                  conversations={ad.metrics.conversations}
                />
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 sm:text-right">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dt className="truncate text-[11px] text-muted-foreground">{stat.label}</dt>
                  <dd className="flex items-center gap-1 truncate text-sm font-semibold tabular-nums sm:justify-end">
                    <IndicatorPopover
                      orderId={orderId}
                      ad={ad}
                      metric={stat.key}
                      canFix={canEdit}
                      isEnabled={isQualityScoreVisible}
                    />
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          + {hiddenCount} {hiddenCount === 1 ? "anúncio" : "anúncios"} — abra a campanha para ver todos
        </p>
      )}
    </div>
  );
}
