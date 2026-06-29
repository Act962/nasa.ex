/**
 * Helpers pra detectar qual section do canvas está atualmente visível
 * no viewport — usado pelo `handleAdd` do builder pra inserir átomos
 * novos DENTRO da section visível (como interlude block) em vez de
 * criarem posicionamento absoluto sobre os outros elementos.
 *
 * Estratégia:
 *   1. Pega o scroll container do canvas (`[data-pages-canvas-scroll]`)
 *      pra ter a viewport visível certa (não a do browser inteiro —
 *      o canvas tem zoom + scroll próprio).
 *   2. Itera por todos os `[data-el-id]` filhos do artboard.
 *   3. Pra cada um que represente uma flow section, calcula a
 *      interseção do bounding box com o viewport do scroller.
 *   4. Retorna o id do que tem MAIOR área visível (ou simplesmente o
 *      primeiro que ultrapassa metade visível).
 *
 * Server-safe: retorna null fora do browser.
 */

import type { ElementBase } from "../types";
import { isFlowSection } from "./section-flow";
import { createInterludeBlock, type InterludeBlock } from "../components/elements/sections/interlude-block";
import type { ElementType } from "../types";

/**
 * Acha o id do flow section atualmente mais visível no viewport do canvas.
 * Retorna null quando rodando server-side ou quando nenhuma section
 * está visível (canvas vazio ou todos átomos).
 */
export function findVisibleSectionId(
  elements: ElementBase[],
): string | null {
  if (typeof document === "undefined") return null;
  // Constroi set de ids que SÃO flow sections — pra filtrar átomos do DOM.
  const flowSectionIds = new Set(
    elements.filter((el) => isFlowSection(el.type)).map((el) => el.id),
  );
  if (flowSectionIds.size === 0) return null;

  const scroller = document.querySelector<HTMLElement>(
    "[data-pages-canvas-scroll]",
  );
  // Fallback pra window quando o scroller não existe (modo embed/preview).
  const viewportRect = scroller
    ? scroller.getBoundingClientRect()
    : {
        top: 0,
        bottom: typeof window !== "undefined" ? window.innerHeight : 0,
      };

  let bestId: string | null = null;
  let bestArea = 0;
  // querySelectorAll global — todos os data-el-id na page, incluindo os
  // de children de groups (que também são renderizados com o atributo).
  const nodes = document.querySelectorAll<HTMLElement>("[data-el-id]");
  nodes.forEach((node) => {
    const id = node.getAttribute("data-el-id");
    if (!id || !flowSectionIds.has(id)) return;
    const rect = node.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, viewportRect.top);
    const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
    const visibleH = Math.max(0, visibleBottom - visibleTop);
    if (visibleH > bestArea) {
      bestArea = visibleH;
      bestId = id;
    }
  });

  return bestId;
}

/**
 * Mapeia um ElementType (átomo do builder) para um InterludeBlock kind
 * equivalente, retornando o block já construído com defaults. Retorna
 * null quando não há mapeamento direto (átomo sem equivalente —
 * caller deve fallback pro comportamento absoluto).
 *
 * Convenções:
 *   - `text` → InterludeBlock kind="text"
 *   - `button` → kind="button"
 *   - `image` → kind="image"
 *   - `video` → kind="video"
 *   - `embed` → kind="embed"
 *   - `shape` (linha horizontal estreita) → kind="divider"
 *   - outros (chat-button, marketing, sticky-cta, etc) → null (mantém
 *     comportamento absoluto, fora do fluxo de uma section).
 */
export function mapElementToInterludeBlock(
  type: ElementType,
  baseElement: ElementBase,
): InterludeBlock | null {
  switch (type) {
    case "text": {
      const block = createInterludeBlock("text");
      const textContent =
        typeof baseElement.content === "string"
          ? baseElement.content
          : block.text;
      return { ...block, text: textContent };
    }
    case "button": {
      const block = createInterludeBlock("button");
      const label =
        (baseElement.label as string | undefined) ?? block.label ?? "Botão";
      const href = (baseElement.href as string | undefined) ?? block.href;
      return { ...block, label, href };
    }
    case "image": {
      const block = createInterludeBlock("image");
      const src = (baseElement.src as string | undefined) ?? block.src;
      const alt = (baseElement.alt as string | undefined) ?? block.alt;
      return { ...block, src, alt };
    }
    case "video": {
      const block = createInterludeBlock("video");
      const videoUrl =
        (baseElement.videoUrl as string | undefined) ??
        (baseElement.src as string | undefined);
      if (videoUrl) {
        return { ...block, videoUrl };
      }
      return block;
    }
    case "embed": {
      const block = createInterludeBlock("embed");
      const embedHtml =
        (baseElement.html as string | undefined) ??
        (baseElement.content as string | undefined);
      if (embedHtml) {
        return { ...block, embedHtml };
      }
      return block;
    }
    case "carousel": {
      // Carousel element ↔ InterludeBlock kind "carousel". Mantém TODOS
      // os campos do carrossel (slides, modos, autoplay, etc) porque o
      // InterludeBlock estendido tem o mesmo padrão que o elemento
      // principal. Sem isso, mover carrossel pra dentro de section
      // perdia a config.
      const block = createInterludeBlock("carousel");
      return {
        ...block,
        slides:
          (baseElement.slides as InterludeBlock["slides"]) ?? block.slides,
        carouselMode:
          (baseElement.carouselMode as InterludeBlock["carouselMode"]) ??
          block.carouselMode,
        slidesPerView:
          (baseElement.slidesPerView as number | undefined) ??
          block.slidesPerView,
        slidesPerViewMobile:
          (baseElement.slidesPerViewMobile as number | undefined) ??
          block.slidesPerViewMobile,
        autoplay:
          (baseElement.autoplay as boolean | undefined) ?? block.autoplay,
        intervalMs:
          (baseElement.intervalMs as number | undefined) ?? block.intervalMs,
        showDots:
          (baseElement.showDots as boolean | undefined) ?? block.showDots,
        showArrows:
          (baseElement.showArrows as boolean | undefined) ?? block.showArrows,
        gap: (baseElement.gap as number | undefined) ?? block.gap,
        imageMode:
          (baseElement.imageMode as InterludeBlock["imageMode"]) ??
          block.imageMode,
        imageHeight:
          (baseElement.imageHeight as number | undefined) ?? block.imageHeight,
        imageWidth:
          (baseElement.imageWidth as number | undefined) ?? block.imageWidth,
        borderRadius:
          (baseElement.radius as number | undefined) ??
          (baseElement.borderRadius as number | undefined) ??
          block.borderRadius,
      };
    }
    case "nasa-link": {
      // NASA link funciona como botão no contexto de interlude. Mantém
      // label + href resolvido.
      const block = createInterludeBlock("button");
      const label =
        (baseElement.label as string | undefined) ?? block.label ?? "Link";
      const href =
        (baseElement.href as string | undefined) ?? block.href;
      return { ...block, label, href };
    }
    case "shape": {
      // Shape como divider — só faz sentido quando o user provavelmente
      // queria uma linha horizontal. Mapeamento opt-in via campo
      // `shapeKind === "line"`. Outras shapes (círculo, retângulo) caem
      // no fallback inline-element abaixo.
      if (baseElement.shapeKind === "line") {
        return createInterludeBlock("divider");
      }
      break;
    }
    default:
      break;
  }

  // ── Fallback universal: kind "inline-element" ────────────────────
  // Pra TODOS os tipos sem mapeamento dedicado acima (social, icon,
  // spacer, group, shape não-linear, e qualquer tipo novo adicionado
  // no futuro), encapsulamos o ElementBase inteiro num bloco genérico
  // que o renderer carrega via ElementRenderer normal. Garante que
  // "Adicionar à camada" funcione pra QUALQUER elemento.
  //
  // Exclusões intencionais — tipos que NÃO devem entrar em section
  // composta porque são overlays globais ou widgets com contexto
  // próprio que conflita:
  const EXCLUDED_TYPES = new Set<ElementType>([
    "chat-button",
    "marketing",
    "exit-intent",
    "embedded-form",
    "group", // grupos já são containers próprios
    // Flow sections: já são camadas — checagem feita no caller
    "section-navbar",
    "section-footer",
    "section-hero",
    "section-features",
    "section-pricing",
    "section-testimonials",
    "section-stats",
    "section-faq",
    "section-cta",
    "section-logo-cloud",
  ]);
  if (EXCLUDED_TYPES.has(type)) return null;

  const inlineBlock = createInterludeBlock("inline-element");
  // Serializa o elemento completo no block. Removemos campos derivados
  // que perderiam significado (selecionado, hover, etc) — tudo o que
  // tá no JSON do layout é seguro de copiar.
  return {
    ...inlineBlock,
    inlineElement: { ...baseElement },
  };
}
