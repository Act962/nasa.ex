import { FiltersTracking } from "@/features/trackings/components/filters";
import { BoardContainer } from "@/features/trackings/components/board-container";
import { KanbanCanvas } from "@/features/trackings/components/kanban-canvas";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { trackingId } = await params;

  return (
    // `KanbanCanvas` aplica o bg customizado (cor + imagem) num wrapper
    // que envolve barra de filtros + board. Sem custom = transparente,
    // herda o tema (claro/escuro/sistema). Resultado: ao recolher a
    // barra de filtros, NÃO aparece "faixa" colorida do tema — só o bg
    // do kanban (ou o do tema, se nada foi configurado).
    <KanbanCanvas trackingId={trackingId}>
      <FiltersTracking />
      <div className="relative flex-1 min-h-0 overflow-x-auto scroll-cols-tracking">
        <BoardContainer trackingId={trackingId} />
      </div>
    </KanbanCanvas>
  );
}
