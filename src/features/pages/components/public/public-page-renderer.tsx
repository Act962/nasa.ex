"use client";

import { useEffect, useRef, useState } from "react";
import type { Device, ElementType, PageLayout, ElementBase } from "../../types";
import { DEVICE_PRESETS } from "../../constants";
import { ElementRenderer } from "../elements/element-renderer";
import { resolveElements, getDeviceFromWidth } from "../../lib/responsive";
import { isFlowSection, pageRenderMode } from "../../lib/section-flow";
import { flattenGroupsForRender } from "../../lib/layer-utils";
import {
  AnimatedBorder,
  getAnimatedBorderProps,
} from "../elements/animated-border";
import {
  ScrollReveal,
  getScrollRevealProps,
} from "../elements/scroll-reveal";
import { PageAnalytics } from "./page-analytics";
import { PageTracker } from "./page-tracker";
import { PageRenderContextProvider } from "./page-context";
import { resolvePageBackground } from "../../lib/page-background";

interface Props {
  layout: PageLayout;
  palette?: Record<string, string>;
  fontFamily?: string | null;
  /** Quando definido, ativa o tracker analítico (page view, scroll
   *  markers, clicks, dwell). Pass `undefined` no preview pra não
   *  contar analytics de quem tá só visualizando o rascunho. */
  trackingSlug?: string;
  /** Slug da org dona da page (server-side resolved). Propagado via
   *  Context pro ChatButton — evita confiar em element.orgSlug que
   *  pode ficar stale. */
  organizationSlug?: string;
  /** Slug do root site (multi-page). Vai pro contexto pra navbar
   *  resolver links internos. */
  rootSlug?: string;
  /** Páginas-irmãs publicadas (root + subpages). Default empty array. */
  siblingPages?: Array<{ id: string; slug: string; title: string; isRoot: boolean }>;
  /** Base dos links internos da navbar. `""` quando servido num domínio
   *  próprio (home = `/`, subpages = `/<sub>`). Ausente na rota `/s`. */
  linkBasePath?: string;
}

export function PublicPageRenderer({
  layout,
  palette,
  fontFamily,
  trackingSlug,
  organizationSlug,
  rootSlug,
  siblingPages,
  linkBasePath,
}: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const update = () => setDevice(getDeviceFromWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (layout.mode !== "stacked") return;
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [layout.mode]);

  const artboardWidth = layout.artboard.width ?? 1440;
  const containerWidth = DEVICE_PRESETS[device].width;

  // Detecta se a page é "landing" (tem sections de fluxo) ou "canvas"
  // (átomos posicionados absolutamente, comportamento original).
  const mainElements =
    layout.mode === "single" ? layout.main.elements : layout.front.elements;
  const renderMode = pageRenderMode(mainElements);

  // No modo landing, ocupa viewport inteiro responsivamente. No canvas,
  // mantém maxWidth do device preset (comportamento original).
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: renderMode === "landing" ? "100%" : containerWidth,
    minHeight: renderMode === "landing" ? "100vh" : layout.artboard.minHeight,
    margin: "0 auto",
    background: resolvePageBackground(layout, palette),
    fontFamily: fontFamily ?? "Inter, system-ui, sans-serif",
    color: (palette?.fg as string | undefined) ?? "#0f172a",
    overflow: renderMode === "landing" ? undefined : "hidden",
  };

  // Meta da page (Pixel/GA/UTM defaults) fica em layout.meta.
  // Não há migration de schema — tudo armazenado dentro do JSON
  // `layout` ou `publishedLayout`.
  const pageMeta =
    ((layout as unknown as { meta?: Record<string, string> }).meta ?? {}) as {
      metaPixelId?: string;
      googleTagId?: string;
      gtmId?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmContent?: string;
      utmTerm?: string;
    };

  // Detecta os nomes dos planos em qualquer section-pricing presente na
  // page atual — usado pelo elemento Marketing pra gerar toasts
  // "Fulano adquiriu <plano>". Sem pricing na page, fica empty e o
  // toggle de toasts de compra fica neutralizado.
  const availablePlans: string[] = [];
  for (const el of mainElements) {
    if (el.type === "section-pricing") {
      const plans = (el.plans as Array<{ name?: string }> | undefined) ?? [];
      for (const plan of plans) {
        if (plan.name && !availablePlans.includes(plan.name)) {
          availablePlans.push(plan.name);
        }
      }
    }
  }

  const ctxValue = {
    organizationSlug,
    pageSlug: trackingSlug,
    rootSlug,
    siblingPages,
    linkBasePath,
    availablePlans,
  };

  if (layout.mode === "single") {
    const elements = resolveElements(layout.main.elements, device, artboardWidth);
    // Extrai a navbar com stickyMode `fixed` ou `sticky` pra renderizar
    // FORA do flex-col do LandingFlow — direto no root. Sem isso, o
    // wrapper `<div className="w-full">` ao redor de cada section
    // interfere com `position: fixed` (que precisa "escapar" pra topo
    // do viewport sem interferência de pais).
    const navbarOverlay = elements.find(
      (el) =>
        el.type === "section-navbar" &&
        ((el.stickyMode as string) === "fixed" ||
          (el.stickyMode as string) === "sticky" ||
          el.stickyMode === undefined),
    );
    const restElements = navbarOverlay
      ? elements.filter((el) => el.id !== navbarOverlay.id)
      : elements;
    return (
      <PageRenderContextProvider value={ctxValue}>
        <SmoothScrollStyle />
        <PageAnalytics meta={pageMeta} />
        {trackingSlug && <PageTracker slug={trackingSlug} />}
        {/* Navbar overlay (fora do flex-col): garante z-index real do
            viewport, sem interferência do wrapper interno. */}
        {navbarOverlay && (
          <NavbarOverlay
            navbarElement={navbarOverlay}
            tokens={(layout as { tokens?: unknown }).tokens}
          />
        )}
        <div style={wrapperStyle}>
          {renderMode === "landing" ? (
            <LandingFlow elements={restElements} tokens={(layout as { tokens?: unknown }).tokens} />
          ) : (
            <LayerSurface elements={restElements} minHeight={layout.artboard.minHeight} />
          )}
        </div>
      </PageRenderContextProvider>
    );
  }

  const backSpeed = layout.parallax?.backSpeed ?? 0.3;
  const frontSpeed = layout.parallax?.frontSpeed ?? 1;
  const backElements = resolveElements(layout.back.elements, device, artboardWidth);
  const frontElements = resolveElements(layout.front.elements, device, artboardWidth);

  return (
    <PageRenderContextProvider value={ctxValue}>
      <SmoothScrollStyle />
      <PageAnalytics meta={pageMeta} />
      {trackingSlug && <PageTracker slug={trackingSlug} />}
      <div style={wrapperStyle}>
        <div
          style={{
            transform: `translate3d(0, ${-scrollY * backSpeed}px, 0)`,
            willChange: "transform",
            position: "absolute",
            inset: 0,
          }}
        >
          <LayerSurface elements={backElements} minHeight={layout.artboard.minHeight} />
        </div>
        <div
          style={{
            transform: `translate3d(0, ${-scrollY * (frontSpeed - 1)}px, 0)`,
            willChange: "transform",
            position: "relative",
          }}
        >
          <LayerSurface elements={frontElements} minHeight={layout.artboard.minHeight} />
        </div>
      </div>
    </PageRenderContextProvider>
  );
}

/**
 * Aplica `scroll-behavior: smooth` no <html> dentro do contexto de
 * landing/preview — clicar em <a href="#x"> rola suave ao destino
 * em vez de saltar abrupto. Respeita `prefers-reduced-motion` do
 * usuário (se ele desabilitou animações no OS, mantém scroll
 * instantâneo).
 *
 * Por ser injetado como `<style>` global, só fica ativo enquanto o
 * componente está montado. O editor (que NÃO usa esse renderer)
 * mantém scroll padrão.
 */
function SmoothScrollStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          html { scroll-behavior: smooth; }
          @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto; }
          }
        `,
      }}
    />
  );
}

function LayerSurface({
  elements,
  minHeight,
}: {
  elements: ElementBase[];
  minHeight: number;
}) {
  // Mesmo tratamento do LandingFlow: flatten groups + filtra hidden
  // pra que o modo canvas livre também respeite visibilidade e grupos.
  const visible = flattenGroupsForRender(elements);
  return (
    <div style={{ position: "relative", minHeight }}>
      {visible.map((el) => (
        <div
          key={el.id}
          data-el-id={el.id}
          style={{
            position: "absolute",
            left: el.x,
            top: el.y,
            width: el.w,
            height: el.h,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            opacity: el.opacity ?? 1,
            zIndex: el.zIndex ?? 1,
          }}
        >
          {wrapWithEffects(el, <ElementRenderer element={el} readonly />)}
        </div>
      ))}
    </div>
  );
}

/**
 * Modo "landing" — renderiza TODOS os elementos em fluxo vertical
 * responsivo (ordenados por `y` no canvas), respeitando o tipo:
 *
 * - **Flow sections** (section-*, navbar, footer, marquee): 100% da
 *   largura, altura intrínseca do componente.
 *
 * - **Átomos** (button, text, image, shape, video, embed, etc):
 *   renderizados em containers centralizados (max-w-4xl mx-auto),
 *   preservando o tamanho do elemento mas SEM o posicionamento
 *   absoluto do builder. O `x` do canvas vira "centralizado" e o
 *   `w/h` viram o tamanho da box. Padding vertical pra não colar
 *   nas sections vizinhas.
 *
 * Bug histórico: átomos eram filtrados fora silenciosamente quando
 * a page entrava em modo landing — botões/textos adicionados
 * sumiam ao publicar.
 */
function LandingFlow({
  elements,
  tokens,
}: {
  elements: ElementBase[];
  tokens?: unknown;
}) {
  // 1. Expande filhos de groups pro top-level + filtra `hidden`.
  //    Sem isso, agrupar 1 chat-button + 1 text esconde o chat-button
  //    do dedup (sumiria visualmente), e a flag `hidden` (toggle 👁 na
  //    aba Camadas) ficaria ineficaz no público.
  const flat = flattenGroupsForRender(elements);

  // 2. Singleton types — só renderizamos a primeira ocorrência. Pages
  //    antigas podem ter múltiplos chat-buttons/exit-intents por bug
  //    do editor antigo; o renderer dedupa em vez de exibir vários
  //    botões empilhados / 2 popovers simultâneos.
  const SINGLETON_RENDER = new Set([
    "chat-button",
    "exit-intent",
    "section-navbar",
    "section-footer",
    "marketing",
  ]);
  const seenSingletons = new Set<string>();
  const deduped = flat.filter((el) => {
    if (!SINGLETON_RENDER.has(el.type)) return true;
    if (seenSingletons.has(el.type)) return false;
    seenSingletons.add(el.type);
    return true;
  });

  const ordered = deduped
    .slice()
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  return (
    <div className="flex flex-col w-full">
      {ordered.map((el) => {
        const isFlow = isFlowSection(el.type as ElementType);
        if (isFlow) {
          // Section em fluxo — full-width
          return (
            <div
              key={el.id}
              data-el-id={el.id}
              className="w-full"
              style={{
                opacity: el.opacity ?? 1,
                zIndex: el.zIndex ?? 1,
              }}
            >
              {wrapWithEffects(
                el,
                <ElementRenderer
                  element={el}
                  readonly
                  tokens={tokens as never}
                />,
              )}
            </div>
          );
        }
        // Átomo — container centralizado com padding vertical.
        // Box interna mantém o tamanho desenhado no builder (w x h),
        // mas se for maior que 100% da viewport, fica max-width 100%.
        return (
          <div
            key={el.id}
            data-el-id={el.id}
            className="w-full px-4 sm:px-6 lg:px-8 py-4 flex justify-center"
            style={{
              opacity: el.opacity ?? 1,
              zIndex: el.zIndex ?? 1,
            }}
          >
            <div
              style={{
                width: el.w,
                maxWidth: "100%",
                height: el.h,
                position: "relative",
              }}
            >
              {wrapWithEffects(
                el,
                <ElementRenderer
                  element={el}
                  readonly
                  tokens={tokens as never}
                />,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renderiza a navbar FORA do flex-col do LandingFlow pra garantir que
 * `position: fixed` realmente fixe no topo do viewport — sem
 * interferência do wrapper interno que cria stacking context indesejado.
 *
 * Quando `stickyMode === "fixed"`, mede dinamicamente a altura real da
 * navbar via ResizeObserver e renderiza um SPACER invisível com a
 * mesma altura logo após — pra compensar o `position: fixed` (que tira
 * a navbar do fluxo) e evitar que o conteúdo abaixo "suba" pra debaixo
 * dela.
 *
 * z-index: 9999 garante que fique acima de qualquer outra section
 * sem precisar configuração.
 */
function NavbarOverlay({
  navbarElement,
  tokens,
}: {
  navbarElement: ElementBase;
  tokens: unknown;
}) {
  // Default agora é "fixed" — quando o user escolhe "Fixado" no editor,
  // queremos position:fixed real (sempre visível no topo do viewport).
  // Pages legadas que tinham stickyMode = "sticky" continuam usando CSS
  // sticky (modo "Acompanha"), mas a melhoria abaixo torna sticky robusto
  // também (era a causa do bug de "Navbar fixed sumindo no scroll").
  const stickyMode = (navbarElement.stickyMode as string | undefined) ?? "fixed";
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setMeasuredHeight(Math.ceil(entry.contentRect.height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const position: React.CSSProperties["position"] =
    stickyMode === "static"
      ? "relative"
      : stickyMode === "fixed"
        ? "fixed"
        : "sticky";

  // `isolation: isolate` cria um stacking context próprio garantindo que
  // o z-index 9999 seja respeitado mesmo quando algum ancestor cria um
  // contexto de empilhamento via transform/filter/will-change. Era a
  // causa do "navbar sumindo no scroll" — algum ancestor (animated
  // border, scroll reveal, transform de animações) criava stacking
  // context e capturava o fixed/sticky.
  //
  // `transform: translateZ(0)` força o navegador a promover o elemento
  // pra GPU layer, evitando o repaint bug do Chrome/Safari onde fixed
  // elements com backdrop-blur "piscam" ou somem ao scrollar rápido.
  const overlayStyle: React.CSSProperties = {
    position,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    isolation: "isolate",
    transform: "translateZ(0)",
    willChange: stickyMode === "fixed" ? "transform" : undefined,
  };

  return (
    <>
      <div ref={wrapperRef} style={overlayStyle}>
        <ElementRenderer
          element={navbarElement}
          readonly
          tokens={tokens as never}
        />
      </div>
      {/* Spacer compensatório: só quando "fixed", porque sticky/static
          já ocupam espaço no fluxo. */}
      {stickyMode === "fixed" && measuredHeight > 0 && (
        <div aria-hidden style={{ height: measuredHeight }} />
      )}
    </>
  );
}

/**
 * Aplica os efeitos opcionais do element (borda animada + scroll
 * reveal) ao redor do conteúdo renderizado. Ordem de aninhamento:
 *
 *   ScrollReveal (mais externo)
 *     └── AnimatedBorder
 *           └── conteúdo (children)
 *
 * Quando NENHUM efeito está ligado, devolve `children` direto (zero
 * overhead).
 */
function wrapWithEffects(
  el: ElementBase,
  children: React.ReactNode,
): React.ReactNode {
  const border = getAnimatedBorderProps(el as unknown as Record<string, unknown>);
  const scroll = getScrollRevealProps(el as unknown as Record<string, unknown>);
  let content: React.ReactNode = children;
  if (border) {
    content = (
      <AnimatedBorder
        colors={border.colors}
        width={border.width}
        speedSec={border.speedSec}
        radius={border.radius}
      >
        {content}
      </AnimatedBorder>
    );
  }
  if (scroll) {
    content = (
      <ScrollReveal
        preset={scroll.preset}
        distance={scroll.distance}
        durationMs={scroll.durationMs}
        delayMs={scroll.delayMs}
        threshold={scroll.threshold}
        replay={scroll.replay}
      >
        {content}
      </ScrollReveal>
    );
  }
  return content;
}
