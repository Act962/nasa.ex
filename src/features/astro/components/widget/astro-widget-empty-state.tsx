"use client";

import { cn } from "@/lib/utils";
import { usePaymentTabStore } from "@/features/payment/store/use-payment-tab-store";
import { resolveWidgetScreenContext } from "@/features/astro/lib/widget-screen-context";
import { useAstroAppBriefing } from "@/features/astro/hooks/use-astro-app-briefing";
import { AstroWidgetBriefingThread } from "./astro-widget-briefing-thread";

/**
 * Tela inicial do painel. Nos Apps com resumo (spec 0056) as sugestões ficam em
 * cima e o Astro já "manda" a mensagem da semana embaixo; nos outros, a
 * pergunta grande no centro com as sugestões abaixo. Tocar numa sugestão envia na hora.
 */
export function AstroWidgetEmptyState({
  pathname,
  disabled,
  hasConversation,
  isArrival = false,
  onSelect,
}: {
  pathname: string;
  disabled: boolean;
  /** Conversa começou: a abertura sobe para o topo, sem centralizar, e as mensagens vêm embaixo dela. */
  hasConversation: boolean;
  /** Usuário trocou de App com o painel aberto: o Astro manda as informações do App novo no meio da conversa. */
  isArrival?: boolean;
  onSelect: (text: string) => void;
}) {
  const paymentTab = usePaymentTabStore((state) => state.activeTab);
  const { heading, suggestions, hint, briefingApp, screenLabel } = resolveWidgetScreenContext(pathname, paymentTab);
  const briefing = useAstroAppBriefing(briefingApp);
  const briefingMessage = briefing.data?.message ?? null;
  const isBriefingRestricted = briefing.data?.isRestricted ?? false;
  // Erro ou resposta vazia não pode prender o "digitando": cai na pergunta do App.
  const hasBriefingFailed = briefing.isError || (briefing.isSuccess && !briefingMessage);
  const isBriefingLoading = Boolean(briefingApp) && briefing.isPending && !briefing.isError;
  const shouldShowBriefing = isBriefingLoading || Boolean(briefingMessage);

  const suggestionList = (
    <div className="w-full max-w-sm space-y-1">
      {suggestions.map(({ label, icon: SuggestionIcon }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(label)}
          className="flex w-full items-center gap-3 rounded-2xl px-1.5 py-1.5 text-left text-sm text-foreground/75 transition hover:bg-foreground/[0.04] hover:text-foreground disabled:opacity-50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-info/10 text-info">
            <SuggestionIcon className="size-5" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );

  const followUpMessage = isBriefingRestricted
    ? undefined
    : `Quer saber algo mais ${screenLabel.charAt(0).toLowerCase()}${screenLabel.slice(1)}?`;

  // Sem resumo do App, a chegada ainda ganha uma mensagem do Astro: a pergunta do App, digitada ao vivo.
  if (isArrival) {
    return (
      <div className="flex flex-col items-center gap-6 px-5 pt-4 pb-2">
        {!isBriefingRestricted && suggestionList}
        <AstroWidgetBriefingThread
          summaryMessage={briefingApp && !hasBriefingFailed ? briefingMessage : heading}
          followUpMessage={briefingApp && !hasBriefingFailed ? followUpMessage : undefined}
        />
      </div>
    );
  }

  // Com resumo, as sugestões vêm primeiro e a mensagem do Astro fica embaixo, perto da caixa de texto, como numa conversa.
  if (shouldShowBriefing) {
    return (
      <div className={cn("flex flex-col items-center gap-6 px-5", hasConversation ? "pt-5 pb-2" : "flex-1 justify-center py-8")}>
        {!isBriefingRestricted && suggestionList}
        <AstroWidgetBriefingThread
          summaryMessage={briefingMessage}
          followUpMessage={followUpMessage}
        />
      </div>
    );
  }

  if (hasConversation) {
    return <div className="flex flex-col items-center px-5 pt-5 pb-2">{suggestionList}</div>;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
      <h2 className="mb-6 max-w-[22ch] text-center text-[1.7rem] font-semibold leading-tight tracking-tight text-balance text-foreground">
        {heading}
      </h2>
      {suggestionList}
      {hint && (
        <p className="mt-5 max-w-sm text-center text-xs leading-relaxed text-foreground/35">{hint}</p>
      )}
    </div>
  );
}
