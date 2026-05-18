"use client";

import {
  isToolUIPart,
  isTextUIPart,
  isReasoningUIPart,
  type UIMessage,
} from "ai";
import { cn } from "@/lib/utils";
import { isAstroTablePayload } from "@/features/astro/lib/astro-table";
import { AstroDataTable } from "@/features/astro/components/astro-data-table";
import { isAstroVideosPayload } from "@/features/astro/lib/astro-video";
import { AstroVideoCardList } from "@/features/astro/components/astro-video-card";
import { isAstroChartPayload } from "@/features/astro/lib/astro-chart";
import { AstroChartCard } from "@/features/astro/components/astro-chart-card";

/**
 * Render de uma `UIMessage` do AI SDK.
 *
 * Cobre os tipos de part do MVP:
 *   - text         → bolha de chat (cinza para user, claro para assistant).
 *   - tool-*       → chip com nome da tool, estado e input/output em <details>.
 *   - reasoning    → bloco italic clarinho (modelos thinking).
 *
 * Não tenta ser exaustivo (file/source/data parts ficam sem render no MVP).
 */
export function AstroMessage({
  message,
  cumulativeTokens,
}: {
  message: UIMessage;
  /**
   * Total acumulado de tokens da sessão até (e incluindo) esta mensagem.
   * Passado pelo parent que itera todas as mensagens — assim o footer
   * mostra a somatória, não só a requisição atual.
   */
  cumulativeTokens?: number;
}) {
  const isUser = message.role === "user";

  // ENFORCEMENT NO CLIENT: se a mensagem do assistant tem ALGUMA tool
  // que retorna `kind:"astro_table"` ou `kind:"astro_videos"`, suprime
  // TODAS as partes de texto dessa mensagem. Sem isso, o modelo continua
  // verbalizando uma versão em prosa da tabela mesmo com o prompt
  // dizendo "responda vazio" — agora é garantido na UI: tabela + zero
  // texto duplicado.
  const hasStructuredOutput =
    !isUser &&
    message.parts.some((p) => {
      if (!isToolUIPart(p)) return false;
      const out = (p as { output?: unknown }).output;
      return (
        isAstroTablePayload(out) ||
        isAstroVideosPayload(out) ||
        isAstroChartPayload(out)
      );
    });

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 px-3 py-2",
        isUser ? "items-end" : "items-start",
      )}
    >
      {message.parts.map((part, idx) => {
        if (isTextUIPart(part)) {
          // Suprime texto duplicado quando há tabela/vídeos na mesma
          // mensagem. User pediu APENAS a tabela — sem prosa redundante.
          if (hasStructuredOutput) return null;
          return (
            <div
              key={idx}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                isUser
                  ? "bg-transparent text-white"
                  : "bg-blue-500/10 text-blue-300",
              )}
            >
              {part.text}
            </div>
          );
        }

        if (isReasoningUIPart(part)) {
          return (
            <div
              key={idx}
              className="max-w-[85%] rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground"
            >
              {part.text}
            </div>
          );
        }

        if (isToolUIPart(part)) {
          // POLÍTICA: tools são detalhe de backend — NUNCA mostre o
          // chip cru pro usuário. O thinking loader (foguete) já
          // sinaliza atividade.
          //
          // Exceções: outputs estruturados que renderizam UI rica
          // (tabela clicável, cards de vídeo). Esses SIM renderizam,
          // mas como componente próprio — não como chip "tool-name".
          const output = (part as { output?: unknown }).output;
          if (isAstroTablePayload(output)) {
            return (
              <div
                key={idx}
                className="w-full max-w-[95%] sm:max-w-[85%]"
              >
                <AstroDataTable payload={output} />
              </div>
            );
          }
          if (isAstroVideosPayload(output)) {
            return (
              <div
                key={idx}
                className="w-full max-w-[95%] sm:max-w-[85%]"
              >
                <AstroVideoCardList payload={output} />
              </div>
            );
          }
          if (isAstroChartPayload(output)) {
            return (
              // `self-stretch` força o filho do flex-column-items-start a
              // ocupar a largura total disponível. Sem isso, o wrapper
              // ficava com width=0 e o ResponsiveContainer do recharts
              // não desenhava nada (chart "vazio" mesmo com data).
              <div
                key={idx}
                className="self-stretch w-full max-w-[95%] sm:max-w-[85%]"
              >
                <AstroChartCard payload={output} />
              </div>
            );
          }
          // Qualquer outra tool: invisível no UI.
          return null;
        }

        return null;
      })}

      {/* Token counter no rodapé das respostas do assistant (silencioso —
          sem mostrar valor em Stars; cobrança é debitada server-side).
          Mostra somatória acumulada da sessão até esta mensagem, não só
          o gasto da requisição atual. */}
      {!isUser &&
        typeof cumulativeTokens === "number" &&
        cumulativeTokens > 0 && (
          <span className="text-[10px] text-muted-foreground/60 px-1">
            {cumulativeTokens.toLocaleString("pt-BR")} tokens
          </span>
        )}
    </div>
  );
}

// Nota: o componente <ToolPart> antigo (chip "tool-name OK/ERRO/...") foi
// REMOVIDO. Tools são detalhe de backend — usuário só vê texto + payloads
// estruturados (AstroDataTable, AstroVideoCardList). Atividade durante o
// thinking é representada pelo foguete (ThinkingDisplay).
