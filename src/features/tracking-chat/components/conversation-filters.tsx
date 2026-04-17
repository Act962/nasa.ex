"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, EllipsisIcon } from "lucide-react";
import Link from "next/link";
import type { SVGProps } from "react";
import { integrations } from "@/data/integrations";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";

type ChannelFilter = "ALL" | "WHATSAPP" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK";

interface ConversationFiltersProps {
  trackingId: string | null;
  selectedChannel: ChannelFilter;
  onChannelChange: (channel: ChannelFilter) => void;
  statusFlowFilter: "FINISHED" | "ACTIVE" | null;
  onStatusFlowFilterChange: (filter: "FINISHED" | "ACTIVE" | null) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
}

export function ConversationFilters({
  trackingId,
  selectedChannel,
  onChannelChange,
  statusFlowFilter,
  onStatusFlowFilterChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  selectedTagIds,
  onSelectedTagIdsChange,
}: ConversationFiltersProps) {
  const { installedSlugs } = useMarketplace();

  const messengerIntegrations = integrations.filter(
    (integration) =>
      integration.category === "messengers" &&
      (integration.status === "installed" || installedSlugs.has(integration.slug)),
  );

  const { data, isLoading } = useQuery({
    ...orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId ?? undefined,
        },
      },
    }),
    enabled: !!trackingId,
  });

  const tags = data?.tags ?? [];

  const toggleTag = (tagId: string) => {
    onSelectedTagIdsChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  };

  const hasTagSelection = selectedTagIds.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-accent-foreground/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {messengerIntegrations.map((integration) => {
          const mapping = getChannelMappingFromSlug(integration.slug);
          const channelId = mapping?.id ?? "ALL";
          const isActive = selectedChannel === channelId;

          return (
            <button
              key={integration.slug}
              type="button"
              title={integration.name}
              onClick={() => onChannelChange(isActive ? "ALL" : channelId)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border transition-colors overflow-hidden bg-background",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent",
              )}
            >
              {mapping?.renderIcon ? (
                mapping.renderIcon()
              ) : (
                <span className="text-base">{integration.icon}</span>
              )}
            </button>
          );
        })}

        <Link href="/integrations?category=mensageiros">
          <button
            type="button"
            title="Todos os canais"
            className={cn(
              "flex size-11 items-center justify-center rounded-full border transition-colors",
              selectedChannel === "ALL"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 text-muted-foreground hover:bg-accent",
            )}
          >
            <MoreChannelsIcon className="size-5" />
          </button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QuickFilterButton
          label="Finalizados"
          active={statusFlowFilter === "FINISHED"}
          onClick={() =>
            onStatusFlowFilterChange(
              statusFlowFilter === "FINISHED" ? null : "FINISHED",
            )
          }
        />
        <QuickFilterButton
          label="Em atendimento"
          active={statusFlowFilter === "ACTIVE"}
          onClick={() =>
            onStatusFlowFilterChange(statusFlowFilter === "ACTIVE" ? null : "ACTIVE")
          }
        />
        <QuickFilterButton
          label="Favoritas"
          active={favoritesOnly}
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hasTagSelection ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
            >
              Etiquetas
              {hasTagSelection ? ` (${selectedTagIds.length})` : ""}
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Filtrar por etiquetas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!trackingId ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Selecione um tracking para ver as etiquetas.
              </div>
            ) : isLoading ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Carregando etiquetas...
              </div>
            ) : tags.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Nenhuma etiqueta encontrada.
              </div>
            ) : (
              tags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? "currentColor" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
            {hasTagSelection && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => onSelectedTagIdsChange([])}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Limpar etiquetas
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function QuickFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="h-8 rounded-full px-3 text-xs"
    >
      {label}
    </Button>
  );
}

function getChannelMappingFromSlug(slug: string):
  | {
      id: ChannelFilter;
      renderIcon?: () => React.JSX.Element;
    }
  | undefined {
  if (slug === "whatsapp-business") {
    return {
      id: "WHATSAPP",
      renderIcon: () => <WhatsappLogoIcon className="size-5 text-green-500" />,
    };
  }

  if (slug === "instagram-dm") {
    return {
      id: "INSTAGRAM",
      renderIcon: () => <InstagramLogoIcon className="size-5" />,
    };
  }

  if (slug === "tiktok") {
    return {
      id: "TIKTOK",
      renderIcon: () => <TikTokLogoIcon className="size-5" />,
    };
  }

  if (slug === "facebook-messenger") {
    return {
      id: "FACEBOOK",
      renderIcon: () => <FacebookLogoIcon className="size-5 text-[#0082FB]" />,
    };
  }

  return undefined;
}

function WhatsappLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2m0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2M12 6.85A5.15 5.15 0 1 1 6.85 12 5.16 5.16 0 0 1 12 6.85m0 1.8A3.35 3.35 0 1 0 15.35 12 3.35 3.35 0 0 0 12 8.65" />
    </svg>
  );
}

function TikTokLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.64 3c.2 1.72 1.18 3.3 2.68 4.17A6.4 6.4 0 0 0 21 8.1v2.83a9.06 9.06 0 0 1-4.48-1.19v5.48A5.22 5.22 0 0 1 11.3 20.4 5.22 5.22 0 0 1 6.1 15.2 5.22 5.22 0 0 1 11.3 10c.26 0 .51.02.76.06v2.88a2.67 2.67 0 0 0-.76-.11 2.37 2.37 0 0 0-2.37 2.37 2.37 2.37 0 0 0 3.98 1.72c.36-.33.56-.8.56-1.29V3z" />
    </svg>
  );
}

function FacebookLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 22v-8.2h2.77l.42-3.2H13.5V8.56c0-.93.26-1.56 1.6-1.56h1.7V4.13c-.3-.04-1.32-.13-2.51-.13-2.48 0-4.19 1.52-4.19 4.3v2.3H7.3v3.2h2.8V22z" />
    </svg>
  );
}

function MoreChannelsIcon(props: SVGProps<SVGSVGElement>) {
  return <EllipsisIcon aria-hidden="true" {...props} />;
}
