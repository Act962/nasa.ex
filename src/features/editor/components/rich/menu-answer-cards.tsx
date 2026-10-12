"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Position } from "@xyflow/react";
import { BaseHandle } from "@/components/react-flow/base-handle";

// Ao lado do celular, a resposta que cada pergunta do menu devolve (spec 0098). O cartão é só leitura:
// a resposta mora no menu salvo e sai pelo código. O ponto à direita do cartão é a saída do fluxo, para
// ligar o que acontece depois da resposta.

export interface MenuAnswerOutput {
  /** Nome da saída no fluxo. */
  id: string;
  answer: string;
}

const CONNECTOR_WIDTH = 44;
const CHANNEL_START = 10;
const CHANNEL_STEP = 5;
const ANSWER_LINE_COLOR = "color-mix(in oklab, var(--success) 55%, white)";

interface ConnectorLine {
  key: string;
  path: string;
  startX: number;
  startY: number;
}

function offsetWithin(element: HTMLElement, ancestor: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { left, top };
}

export const OPTION_ROW_ATTRIBUTE = "data-option-row";

export function MenuAnswerCards({
  outputs,
  optionTitles,
  menuHref,
  layoutKey,
  children,
}: {
  /** Uma posição por opção do menu, na ordem do celular; `null` nas opções sem resposta guardada. */
  outputs: (MenuAnswerOutput | null)[];
  optionTitles: string[];
  /** Onde o texto da resposta é editado. */
  menuHref?: string;
  /** Muda quando o conteúdo do celular muda de altura (texto da mensagem): as linhas são medidas de novo. */
  layoutKey?: string;
  /** O celular, com as linhas das opções marcadas por `OPTION_ROW_ATTRIBUTE`. */
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<ConnectorLine[]>([]);
  const answeredRows = outputs.flatMap((output, rowIndex) => (output ? [{ rowIndex, output }] : []));
  const layoutSignature = answeredRows.map((row) => `${row.rowIndex}:${row.output.id}:${row.output.answer.length}`).join("|") + `#${optionTitles.join("|")}#${layoutKey ?? ""}`;

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rowIndexes = layoutSignature.split("#")[0].split("|").filter(Boolean).map((entry) => Number(entry.split(":")[0]));
    const measured = rowIndexes.flatMap((rowIndex) => {
      const row = wrapper.querySelector<HTMLElement>(`[${OPTION_ROW_ATTRIBUTE}="${rowIndex}"]`);
      const card = wrapper.querySelector<HTMLElement>(`[data-answer-card="${rowIndex}"]`);
      if (!row || !card) return [];
      const rowOffset = offsetWithin(row, wrapper);
      const cardOffset = offsetWithin(card, wrapper);
      return [{ rowIndex, rowRight: rowOffset.left + row.offsetWidth, rowY: rowOffset.top + row.offsetHeight / 2, cardLeft: cardOffset.left, cardY: cardOffset.top + card.offsetHeight / 2 }];
    });
    // Quem sobe vira primeiro quanto mais alto está; quem desce, quanto mais baixo: assim nenhuma linha cruza outra.
    const goingUp = measured.filter((line) => line.cardY <= line.rowY);
    const goingDown = measured.filter((line) => line.cardY > line.rowY).reverse();
    const channelOf = new Map<number, number>();
    goingUp.forEach((line, order) => channelOf.set(line.rowIndex, order));
    goingDown.forEach((line, order) => channelOf.set(line.rowIndex, order));
    setLines(
      measured.map((line) => {
        const channelX = line.rowRight + CHANNEL_START + (channelOf.get(line.rowIndex) ?? 0) * CHANNEL_STEP;
        return {
          key: String(line.rowIndex),
          path: `M ${line.rowRight} ${line.rowY} H ${channelX} V ${line.cardY} H ${line.cardLeft}`,
          startX: line.rowRight,
          startY: line.rowY,
        };
      }),
    );
  }, [layoutSignature]);

  return (
    <div ref={wrapperRef} className="relative flex items-center">
      {children}
      <div style={{ width: CONNECTOR_WIDTH }} className="shrink-0" />
      <div className="flex flex-col gap-1.5">
        {answeredRows.map(({ rowIndex, output }) => (
          <div
            key={output.id}
            data-answer-card={rowIndex}
            className="relative w-[210px] rounded-lg border bg-success/5 px-2.5 py-1.5 text-left"
            style={{ borderColor: ANSWER_LINE_COLOR }}
            title={output.answer}
          >
            <p className="flex items-center justify-between gap-2 text-[10px] font-semibold leading-tight">
              <span className="truncate">Resposta: {optionTitles[rowIndex] || "sem título"}</span>
              {menuHref && (
                <a href={menuHref} target="_blank" rel="noreferrer" className="nodrag shrink-0 font-normal text-info hover:underline" title="Editar o texto desta resposta nos menus do atendimento">
                  editar
                </a>
              )}
            </p>
            <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{output.answer || "Sem resposta escrita."}</p>
            <BaseHandle
              id={output.id}
              type="source"
              position={Position.Right}
              title={`Ligue aqui o que acontece depois que o cliente recebe a resposta de "${optionTitles[rowIndex] ?? ""}"`}
              className="!border-info !bg-background"
            />
          </div>
        ))}
      </div>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {lines.map((line) => (
          <g key={line.key}>
            <path d={line.path} fill="none" stroke={ANSWER_LINE_COLOR} strokeWidth={1.5} strokeLinejoin="round" />
            <circle cx={line.startX} cy={line.startY} r={3} fill="var(--info)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
