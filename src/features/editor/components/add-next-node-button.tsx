import { PlusIcon } from "lucide-react";

// Botão "+" na saída do quadro, que abre a lista de passos para continuar o fluxo. Azul, de contorno
// branco e com um pulso de luz, para ser o convite óbvio de "o que vem depois".

export function AddNextNodeButton() {
  return (
    <span className="relative grid size-6 place-items-center">
      <span aria-hidden className="orbita-add-next-pulse absolute inset-0 rounded-full bg-info" />
      <button
        type="button"
        aria-label="Adicionar próximo passo"
        title="Adicionar próximo passo"
        className="relative grid size-6 place-items-center rounded-full border-2 border-white bg-info text-white shadow-[0_0_10px_var(--info)] transition-transform hover:scale-125"
      >
        <PlusIcon className="size-3.5" strokeWidth={3} />
      </button>
      <style>{`@keyframes orbita-add-next-pulse { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(2.2); opacity: 0; } }
.orbita-add-next-pulse { animation: orbita-add-next-pulse 1.8s ease-out infinite; }
@media (prefers-reduced-motion: reduce) { .orbita-add-next-pulse { animation: none; opacity: 0; } }`}</style>
    </span>
  );
}
