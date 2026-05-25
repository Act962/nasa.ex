"use client";

/**
 * Bottom tab bar do /tracking-chat — inspirado no padrão iOS do WhatsApp:
 * pill flutuante no rodapé com 5 ícones grandes e labels curtos. Cada
 * tab dispara um comportamento diferente:
 *
 * 1. **Configuração** — navega pra settings do tracking atual (antes
 *    ficava no canto superior direito).
 * 2. **Conversas** — tab "ativa" por padrão (highlight). Sem ação
 *    porque já é a tela atual; serve só de affordance visual.
 * 3. **Tracking** — abre o kanban do tracking atual (`/tracking/[id]`),
 *    onde o lead da conversa aberta aparece em sua coluna de status.
 *    Sempre habilitado quando há um tracking selecionado na sidebar.
 * 4. **Canal** — cicla pelo filtro de canal (`ALL` → `WHATSAPP` →
 *    `INSTAGRAM` → `FACEBOOK` → ALL). Ícone reflete o canal atual; rótulo
 *    mostra o nome.
 * 5. **Tags** — abre dropdown com etiquetas pra filtrar a lista.
 *
 * Substitui a antiga row de circles + filter pills que ocupava muito
 * espaço no meio da sidebar.
 */

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
import { useRouter } from "next/navigation";
import {
  SettingsIcon,
  MessageSquareIcon,
  KanbanSquareIcon,
  TagIcon,
  EllipsisIcon,
} from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { toast } from "sonner";
import type { ReactNode } from "react";

type ChannelFilter = "ALL" | "WHATSAPP" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK";

interface BottomTabsProps {
  trackingId: string | null;
  selectedChannel: ChannelFilter;
  onChannelChange: (channel: ChannelFilter) => void;
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  settingsHref: string;
}

const CHANNEL_CYCLE: ChannelFilter[] = [
  "ALL",
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
];

const CHANNEL_LABEL: Record<ChannelFilter, string> = {
  ALL: "Todos canais",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
};

export function TrackingChatBottomTabs({
  trackingId,
  selectedChannel,
  onChannelChange,
  selectedTagIds,
  onSelectedTagIdsChange,
  settingsHref,
}: BottomTabsProps) {
  const router = useRouter();

  // Lista de tags (mesma query usada antes em ConversationFilters)
  const { data: tagData, isLoading: isLoadingTags } = useQuery({
    ...orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId ?? undefined,
        },
      },
    }),
    enabled: !!trackingId,
  });
  const tags = tagData?.tags ?? [];

  const toggleTag = (tagId: string) => {
    onSelectedTagIdsChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  };
  const hasTagSelection = selectedTagIds.length > 0;

  const cycleChannel = () => {
    const idx = CHANNEL_CYCLE.indexOf(selectedChannel);
    const next = CHANNEL_CYCLE[(idx + 1) % CHANNEL_CYCLE.length];
    onChannelChange(next);
  };

  const openTrackingBoard = () => {
    if (!trackingId) {
      toast.info("Selecione um tracking primeiro");
      return;
    }
    // Navega pro kanban do tracking ativo. O lead da conversa aberta
    // (se houver) aparece na coluna do seu status — visualmente o
    // usuário consegue achar.
    router.push(`/tracking/${trackingId}`);
  };

  return (
    <div className="px-2 pb-3 pt-2 shrink-0">
      {/* Pill container: bordas arredondadas, sombra discreta, fundo
          translúcido como o iOS do WhatsApp. Flex equal-width pros 5 tabs. */}
      <nav
        className={cn(
          "flex items-center justify-around gap-1 rounded-full",
          "border border-border/60 bg-background/95 backdrop-blur-sm",
          "shadow-lg px-2 py-2",
        )}
        aria-label="Ações rápidas do chat"
      >
        <TabButton
          icon={<SettingsIcon className="size-4" />}
          label="Configuração"
          onClick={() => router.push(settingsHref)}
        />

        <TabButton
          icon={<MessageSquareIcon className="size-4" />}
          label="Conversas"
          active
          onClick={() => {
            /* já estamos na tela de conversas */
          }}
        />

        <TabButton
          icon={<KanbanSquareIcon className="size-4" />}
          label="Tracking"
          disabled={!trackingId}
          onClick={openTrackingBoard}
        />

        <TabButton
          icon={<ChannelIcon channel={selectedChannel} />}
          label={CHANNEL_LABEL[selectedChannel]}
          active={selectedChannel !== "ALL"}
          onClick={cycleChannel}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                "rounded-full px-2.5 py-1 transition-colors flex-1 min-w-0",
                hasTagSelection
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Filtrar por etiquetas"
            >
              <TagIcon className="size-4" />
              <span className="text-[10px] truncate max-w-full">
                {hasTagSelection
                  ? `Tags (${selectedTagIds.length})`
                  : "Tags"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Filtrar por etiquetas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!trackingId ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Selecione um tracking primeiro.
              </div>
            ) : isLoadingTags ? (
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
      </nav>
    </div>
  );
}

function TabButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5",
        "rounded-full px-2.5 py-1 transition-colors flex-1 min-w-0",
        active
          ? "text-foreground"
          : disabled
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] truncate max-w-full">{label}</span>
    </button>
  );
}

/**
 * Ícone do canal atual. Pra ALL/TIKTOK usa um EllipsisIcon ou similar
 * porque não temos um logo específico do TikTok no `WhatsappIcon` set.
 */
function ChannelIcon({ channel }: { channel: ChannelFilter }) {
  if (channel === "WHATSAPP") {
    return <WhatsappIcon className="size-4 text-green-500" />;
  }
  if (channel === "INSTAGRAM") {
    return (
      <span className="size-4 rounded-full bg-linear-to-tr from-yellow-400 via-pink-500 to-purple-600" />
    );
  }
  if (channel === "FACEBOOK") {
    return <span className="size-4 rounded-full bg-[#0082FB]" />;
  }
  // ALL ou TIKTOK
  return <EllipsisIcon className="size-4" />;
}
