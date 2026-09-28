"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";

/**
 * Barra que aparece quando há linhas marcadas.
 *
 * Flutua sobre a tabela em vez de empurrar o conteúdo: a lista continua no
 * lugar enquanto o usuário escolhe, e a ação fica ao alcance sem rolar.
 */
export function SelectionBar({
  count,
  leadIds,
  onClear,
}: {
  count: number;
  leadIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  if (count === 0) return null;

  const dispatch = () => {
    // Os ids viajam na URL: /campanhas monta a audiência a partir deles.
    const params = new URLSearchParams({ leads: leadIds.join(",") });
    router.push(`/campanhas?${params.toString()}`);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="text-sm">
          <strong>{count}</strong> {count === 1 ? "selecionado" : "selecionados"}
        </span>
        <Button size="sm" onClick={dispatch}>
          <MessageCircle className="size-4" />
          Disparar mensagens
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Limpar seleção"
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
