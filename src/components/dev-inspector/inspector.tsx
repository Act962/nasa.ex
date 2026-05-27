"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getElementSource, type ElementSource } from "./use-fiber-source";

/**
 * Dev Inspector — hover 3s sobre qualquer elemento revela o componente
 * React + arquivo + linha (do componente e do JSX exato).
 *
 * **Só funciona em dev** — depende de `_debugSource` que o Babel injeta
 * somente quando `NODE_ENV=development`. O `mount` é gated em `index.tsx`.
 *
 * Comportamento:
 *  - `pointermove` reseta um timer de 3s
 *  - Se mouse parar 3s sobre o mesmo elemento → captura a fonte, mostra
 *    contorno vermelho ao redor + label flutuante com info + botão Copiar
 *  - Qualquer movimento novo → cancela timer + esconde overlay
 *  - ESC → esconde overlay
 *  - Skip do próprio overlay via `data-dev-inspector` (atributo nos nós
 *    do inspector + check com `closest()`)
 */

const HOVER_DELAY_MS = 3000;

interface InspectorState {
  source: ElementSource;
  rect: DOMRect;
}

/** Padding em px usado pro hit-test do bounding rect — torna fácil
 *  o mouse "entrar" e "sair" da zona de captura sem perder o overlay. */
const RECT_TOLERANCE_PX = 12;

/** Grace period em ms — quando o mouse sai da zona, esperamos um pouco
 *  antes de esconder o overlay. Dá tempo do usuário cruzar o gap
 *  pequeno entre o elemento e a label flutuante (~4px). */
const LEAVE_GRACE_MS = 500;

export function DevInspector() {
  const [state, setState] = useState<InspectorState | null>(null);

  // Refs pra não disparar re-render no pointermove. State em ref pra ler
  // dentro do listener sem precisar re-attach a cada mudança.
  const targetRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<InspectorState | null>(null);
  const labelRectRef = useRef<DOMRect | null>(null);

  // Sincroniza ref com state pro listener ter acesso atual sem deps.
  useEffect(() => {
    stateRef.current = state;
    if (!state) labelRectRef.current = null;
  }, [state]);

  // Captura snapshot final após 3s de inércia.
  const capture = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) return;
    const src = getElementSource(el);
    if (!src) return;
    setState({ source: src, rect: el.getBoundingClientRect() });
  }, []);

  // Cancela timer + esconde overlay.
  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setState(null);
  }, []);

  // Checa se o ponteiro está numa "zona segura" — dentro do elemento
  // capturado (com tolerância) OU dentro da label do overlay.
  const isInsideSafeZone = useCallback(
    (clientX: number, clientY: number, targetEl: HTMLElement | null) => {
      if (!stateRef.current) return false;
      // Sobre qualquer nó do próprio overlay (label, outline, etc) — zona segura
      if (targetEl?.closest("[data-dev-inspector]")) return true;

      const captured = stateRef.current.rect;
      const insideCaptured =
        clientX >= captured.left - RECT_TOLERANCE_PX &&
        clientX <= captured.right + RECT_TOLERANCE_PX &&
        clientY >= captured.top - RECT_TOLERANCE_PX &&
        clientY <= captured.bottom + RECT_TOLERANCE_PX;
      if (insideCaptured) return true;

      // Também aceita o retângulo da label flutuante (atualizado pelo
      // Overlay via ref após mount/relayout). Isso fecha o gap entre
      // o elemento e a label.
      const label = labelRectRef.current;
      if (label) {
        const insideLabel =
          clientX >= label.left - RECT_TOLERANCE_PX &&
          clientX <= label.right + RECT_TOLERANCE_PX &&
          clientY >= label.top - RECT_TOLERANCE_PX &&
          clientY <= label.bottom + RECT_TOLERANCE_PX;
        if (insideLabel) return true;
      }

      return false;
    },
    [],
  );

  // ── Listener global de pointermove ──────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Caso 1: overlay já tá visível
      if (stateRef.current) {
        if (isInsideSafeZone(e.clientX, e.clientY, target)) {
          // Mouse de volta dentro da zona — cancela qualquer leave pending
          if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
          }
          return;
        }

        // Mouse fora da zona segura. Atualiza target candidato e
        // arma leave timer (se ainda não armado).
        targetRef.current = target;
        if (!leaveTimerRef.current) {
          leaveTimerRef.current = setTimeout(() => {
            leaveTimerRef.current = null;
            // Após grace expirar, esconde overlay e re-arma 3s no novo target
            setState(null);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(capture, HOVER_DELAY_MS);
          }, LEAVE_GRACE_MS);
        }
        return;
      }

      // Caso 2: overlay NÃO visível — fluxo normal de captura
      // Skip se mouse tá sobre overlay órfão (raro, durante transições)
      if (target.closest("[data-dev-inspector]")) return;

      if (targetRef.current === target) return;
      targetRef.current = target;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(capture, HOVER_DELAY_MS);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        reset();
        return;
      }
      // Cmd+C / Ctrl+C copia o path quando overlay tá visível e nenhum
      // texto da página está selecionado (preserva comportamento normal
      // de copy quando o user seleciona texto).
      if (
        stateRef.current &&
        (e.metaKey || e.ctrlKey) &&
        (e.key === "c" || e.key === "C")
      ) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        const path = buildCopyText(stateRef.current.source);
        if (!path) return;
        e.preventDefault();
        navigator.clipboard.writeText(path).catch(() => {});
        // Fecha o overlay logo após copy (UX: confirmação implícita —
        // path foi pro clipboard).
        reset();
      }
    };

    const onScrollOrResize = () => {
      const el = targetRef.current;
      if (!stateRef.current || !el) return;
      if (!el.isConnected) {
        reset();
        return;
      }
      setState({
        source: stateRef.current.source,
        rect: el.getBoundingClientRect(),
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [capture, reset, isInsideSafeZone]);

  // ── Render via portal direto no <body> pra escapar de overflow/ z-index
  // contexts de containers (Dialog, Popover etc). ───────────────────
  if (typeof document === "undefined") return null;
  if (!state) return null;

  return createPortal(
    <Overlay state={state} labelRectRef={labelRectRef} onClose={reset} />,
    document.body,
  );
}

// ─── Overlay JSX ──────────────────────────────────────────────────────

/**
 * Monta texto estruturado a copiar com TODA info disponível pra
 * identificar o elemento.
 *
 * Em React 19 não conseguimos file:line do JSX, então o copy inclui
 * identificadores únicos (tag + componente + texto + classes + attrs)
 * que permitem grep do elemento em segundos.
 */
function buildCopyText(source: ElementSource): string {
  const lines: string[] = [];

  // Linha 1: tag + componente + texto (formato compacto)
  const head: string[] = [`<${source.tagName}>`];
  if (source.textPreview) head.push(`"${source.textPreview}"`);
  if (source.componentName) head.push(`in <${source.componentName}>`);
  lines.push(head.join(" "));

  // Linha 2: cadeia de owners (se houver)
  if (source.ownerChain.length > 0) {
    lines.push(
      `parents: <${source.componentName ?? "?"}> ← ${source.ownerChain
        .map((n) => `<${n}>`)
        .join(" ← ")}`,
    );
  }

  // Linha 3: className (cheia, sem truncar pra preservar grep)
  if (source.className) {
    lines.push(`class: ${source.className}`);
  }

  // Linha 4+: atributos identificadores
  for (const { name, value } of source.attributes) {
    const v = value.length > 80 ? value.slice(0, 80) + "…" : value;
    lines.push(`${name}: ${v}`);
  }

  return lines.join("\n");
}

function Overlay({
  state,
  labelRectRef,
  onClose,
}: {
  state: InspectorState;
  /** Ref que o Overlay preenche com o rect real da label após mount —
   *  usado pelo listener pra detectar "mouse dentro da label" e cancelar
   *  o leave timer. */
  labelRectRef: MutableRefObject<DOMRect | null>;
  /** Chamado após copy bem-sucedido pra esconder o overlay. */
  onClose: () => void;
}) {
  const { source, rect } = state;
  const labelDivRef = useRef<HTMLDivElement | null>(null);

  // Após mount, mede o rect real da label e propaga pro listener via ref.
  useEffect(() => {
    if (labelDivRef.current) {
      labelRectRef.current = labelDivRef.current.getBoundingClientRect();
    }
    return () => {
      labelRectRef.current = null;
    };
  });

  const copyTarget = buildCopyText(source);

  const handleCopy = async (e: React.MouseEvent) => {
    // Shift+Click → modo debug: dump completo do fiber + source pra
    // diagnosticar problemas (útil quando o JSX line tá vindo errado).
    // Não fecha overlay nem copia — apenas inspeciona no console.
    if (e.shiftKey) {
      e.preventDefault();
      // eslint-disable-next-line no-console
      console.group("[DevInspector] debug");
      // eslint-disable-next-line no-console
      console.log("source extracted:", source);
      // Walk fiber tree e loga cada nível (até 10 níveis)
      const overlayEl = (e.currentTarget as HTMLElement).closest(
        "[data-dev-inspector]",
      );
      // Pega o ÚLTIMO target real (antes do overlay) — guardamos em ref
      // via state.rect. Mas pra debug fiber, precisamos do elemento real.
      // Workaround: pega o elemento abaixo da posição central do contorno.
      const rect = state.rect;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Temporariamente esconde overlay pra elementFromPoint pegar o real
      if (overlayEl instanceof HTMLElement) overlayEl.style.display = "none";
      const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
      if (overlayEl instanceof HTMLElement) overlayEl.style.display = "";
      if (el) {
        // eslint-disable-next-line no-console
        console.log("element:", el);
        const fiberKey = Object.keys(el).find((k) =>
          k.startsWith("__reactFiber$"),
        );
        const fiber = fiberKey ? (el as any)[fiberKey] : null;
        // eslint-disable-next-line no-console
        console.log("fiber:", fiber);
        // Walk e loga
        let cursor = fiber;
        const chain: any[] = [];
        for (let i = 0; cursor && i < 12; i++) {
          chain.push({
            depth: i,
            type:
              typeof cursor.type === "string"
                ? cursor.type
                : (cursor.type?.displayName ??
                  cursor.type?.name ??
                  String(cursor.type)),
            _debugSource: cursor._debugSource,
            _debugStack: cursor._debugStack,
            _debugTask: cursor._debugTask,
            _debugOwner: cursor._debugOwner,
          });
          cursor = cursor.return;
        }
        // eslint-disable-next-line no-console
        console.table(chain);
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
      return;
    }
    if (!copyTarget) return;
    try {
      await navigator.clipboard.writeText(copyTarget);
    } catch {
      // Clipboard API pode falhar em alguns contextos — fallback silencioso
    }
    // Fecha o overlay imediatamente após click — UX: confirmação
    // implícita (path foi pro clipboard). Mesma behavior do Cmd+C.
    onClose();
  };

  // Posição da label: prefere ACIMA do elemento; se não couber, abaixo.
  const labelHeight = 70; // estimado
  const labelAbove = rect.top >= labelHeight + 8;
  const labelTop = labelAbove ? rect.top - labelHeight - 4 : rect.bottom + 4;
  const labelLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 360));

  return (
    <div
      data-dev-inspector="1"
      className="fixed inset-0 z-[2147483647] pointer-events-none"
      style={{ contain: "layout style" }}
    >
      {/* Contorno vermelho */}
      <div
        data-dev-inspector="1"
        className="absolute border-2 border-red-500 rounded-sm"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.5), 0 0 12px rgba(239,68,68,0.5)",
        }}
      />

      {/* Label flutuante — mostra info estruturada pra identificar elemento */}
      <div
        ref={labelDivRef}
        data-dev-inspector="1"
        className="absolute bg-zinc-900 text-white text-xs rounded-md shadow-2xl border border-red-500 p-2.5 space-y-1 pointer-events-auto font-mono"
        style={{
          top: labelTop,
          left: labelLeft,
          maxWidth: 440,
          minWidth: 280,
        }}
      >
        {/* Linha 1: tag + componente */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-400 shrink-0">
            &lt;{source.tagName}&gt;
          </span>
          {source.componentName && (
            <>
              <span className="text-zinc-500">in</span>
              <span className="text-red-400 font-bold">
                &lt;{source.componentName}&gt;
              </span>
            </>
          )}
        </div>

        {/* Linha 2: texto visível do elemento (se houver) */}
        {source.textPreview && (
          <div className="text-[10px] text-emerald-300 truncate" title={source.textPreview}>
            “{source.textPreview}”
          </div>
        )}

        {/* Linha 3: owner chain */}
        {source.ownerChain.length > 0 && (
          <div className="text-[10px] text-zinc-400 truncate">
            ← {source.ownerChain.map((n) => `<${n}>`).join(" ← ")}
          </div>
        )}

        {/* Linha 4: className (truncada na UI, copy mantém cheia) */}
        {source.className && (
          <div
            className="text-[10px] text-blue-300 truncate"
            title={source.className}
          >
            class: {source.className}
          </div>
        )}

        {/* Linhas: attrs */}
        {source.attributes.map((a) => (
          <div
            key={a.name}
            className="text-[10px] text-amber-300 truncate"
            title={`${a.name}: ${a.value}`}
          >
            {a.name}: {a.value}
          </div>
        ))}

        {/* Botão copiar + atalhos */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-700">
          <span className="text-[9px] text-zinc-500">
            ⌘C copia · ESC fecha
          </span>
          <button
            type="button"
            onClick={handleCopy}
            data-dev-inspector="1"
            className="ml-auto px-2 py-0.5 text-[10px] font-sans rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-200 transition-colors"
          >
            Copiar info
          </button>
        </div>
      </div>
    </div>
  );
}

