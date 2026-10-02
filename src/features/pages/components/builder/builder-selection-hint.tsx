import { MousePointerClick } from "lucide-react";

/** Aviso mostrado quando nada está selecionado: cada bloco do canvas é editável. */
export function BuilderSelectionHint() {
  return (
    <div className="mx-2 mt-2 mb-3 rounded-[18px] border-2 border-dashed border-info/40 bg-info/10 p-4 text-center">
      <div className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-info/15">
        <MousePointerClick className="size-4 text-info" />
      </div>
      <p className="mb-1.5 text-xs leading-tight font-semibold text-foreground">Toque em qualquer bloco do canvas</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Cada seção (topo, menu, recursos, rodapé…) é <strong>editável</strong>. Ao selecionar, aparecem todos os campos:{" "}
        <em>título, textos, imagens, botões, links e cores</em>.
      </p>
      <p className="mt-2.5 text-[10px] text-muted-foreground">Você também pode arrastar para mover.</p>
    </div>
  );
}
