"use client";

import { useConstructUrl } from "@/hooks/use-construct-url";
import { useKanbanAppearance } from "../hooks/use-kanban-appearance";

/**
 * Wrapper visual do Kanban — aplica `kanbanBackgroundColor` + imagem
 * (com blur/opacity) num único container que envolve TANTO a barra de
 * filtros (FiltersTracking) quanto o board (BoardContainer).
 *
 * Por que aqui e não dentro do BoardContainer: assim a aparência do
 * kanban se estende até embaixo do NavTracking, e a barra de filtros
 * — que é CSS-transparent por default — mostra o mesmo bg que o board.
 * Resultado: ao recolher o header, NÃO aparece nenhuma "faixa" colorida
 * de tema acima do kanban; só o bg customizado (ou o tema light/dark
 * padrão quando não há customização).
 */
export function KanbanCanvas({
  trackingId,
  children,
}: {
  trackingId: string;
  children: React.ReactNode;
}) {
  const { data: appearance } = useKanbanAppearance(trackingId);
  const bgImgUrl = useConstructUrl(appearance?.kanbanBackgroundImage || "");

  return (
    <div
      className="relative h-full flex flex-col min-h-0"
      style={
        appearance?.kanbanBackgroundColor
          ? { backgroundColor: appearance.kanbanBackgroundColor }
          : undefined
      }
    >
      {appearance?.kanbanBackgroundImage && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
          style={{
            backgroundImage: `url(${bgImgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: `blur(${appearance.kanbanBackgroundBlur}px)`,
            opacity: (appearance.kanbanBackgroundOpacity ?? 50) / 100,
          }}
        />
      )}
      {/* Conteúdo (barra + board) acima da camada de imagem. */}
      <div className="relative z-10 flex flex-col h-full min-h-0">
        {children}
      </div>
    </div>
  );
}
