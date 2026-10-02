import type { ReactNode, Ref } from "react";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomeGreeting } from "./home-greeting";
import { AstroSatellites } from "./astro-satellites";
import { CommandInput, type CommandInputHandle, type CommandInputProps } from "./command-input";

interface WelcomeScreenProps {
  commandInputProps: CommandInputProps;
  commandInputRef?: Ref<CommandInputHandle>;
  conversation?: ReactNode;
  isConversationActive?: boolean;
  /** Reabre a última conversa do Histórico; ausente = não há conversa para reabrir. */
  onOpenLastConversation?: () => void;
}

/** Início: logo do ASTRO no centro, a conversa (só títulos) acima da caixa e a caixa de comando no rodapé. */
export function WelcomeScreen({
  commandInputProps,
  commandInputRef,
  conversation,
  isConversationActive = false,
  onOpenLastConversation,
}: WelcomeScreenProps) {
  return (
    <div className="relative flex min-h-full w-full flex-col px-4 select-none">
      {/* Na conversa o ASTRO fica parado no topo, do mesmo tamanho e com os satélites em órbita. */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-5 py-10 transition-all duration-500",
          isConversationActive ? "pointer-events-none sticky top-0 z-10 py-8" : "flex-1",
        )}
      >
        <div className="astro-home-float pointer-events-auto relative my-6">
          <div className="relative z-10 grid size-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 shadow-[0_0_40px_rgba(37,99,235,0.45)]">
            <AstroMark className="size-full" />
          </div>
          <AstroSatellites />
        </div>
        {!isConversationActive && (
          <HomeGreeting />
        )}
      </div>

      {conversation && (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-end select-text">{conversation}</div>
      )}

      {/* Caixa parada no rodapé, com respiro abaixo para o ícone de uso; no celular fica acima do dock. O degradê esconde a conversa que rola por baixo. */}
      <div className="sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-background via-background/85 to-transparent px-4 pt-6 pb-[max(2.5rem,calc(15svh-2.75rem))] select-text md:pb-10">
        <div className="mx-auto w-full max-w-2xl">
          {onOpenLastConversation && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={onOpenLastConversation}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card/70 px-4 text-xs font-medium text-muted-foreground backdrop-blur-md transition-colors hover:bg-card hover:text-foreground"
              >
                <ChevronUpIcon className="size-3.5" />
                Últimas conversas
              </button>
            </div>
          )}
          <CommandInput {...commandInputProps} ref={commandInputRef} />
        </div>
      </div>
    </div>
  );
}
