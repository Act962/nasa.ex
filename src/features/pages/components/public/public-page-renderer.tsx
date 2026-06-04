"use client";

import { useEffect, useState } from "react";
import type { Device, ElementType, PageLayout, ElementBase } from "../../types";
import { DEVICE_PRESETS } from "../../constants";
import { ElementRenderer } from "../elements/element-renderer";
import { resolveElements, getDeviceFromWidth } from "../../lib/responsive";
import { isFlowSection, pageRenderMode } from "../../lib/section-flow";

interface Props {
  layout: PageLayout;
  palette?: Record<string, string>;
  fontFamily?: string | null;
}

export function PublicPageRenderer({ layout, palette, fontFamily }: Props) {
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
    background:
      (palette?.bg as string | undefined) ??
      layout.artboard.background ??
      "#ffffff",
    fontFamily: fontFamily ?? "Inter, system-ui, sans-serif",
    color: (palette?.fg as string | undefined) ?? "#0f172a",
    overflow: renderMode === "landing" ? undefined : "hidden",
  };

  if (layout.mode === "single") {
    const elements = resolveElements(layout.main.elements, device, artboardWidth);
    return (
      <div style={wrapperStyle}>
        {renderMode === "landing" ? (
          <LandingFlow elements={elements} tokens={(layout as { tokens?: unknown }).tokens} />
        ) : (
          <LayerSurface elements={elements} minHeight={layout.artboard.minHeight} />
        )}
      </div>
    );
  }

  const backSpeed = layout.parallax?.backSpeed ?? 0.3;
  const frontSpeed = layout.parallax?.frontSpeed ?? 1;
  const backElements = resolveElements(layout.back.elements, device, artboardWidth);
  const frontElements = resolveElements(layout.front.elements, device, artboardWidth);

  return (
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
  );
}

function LayerSurface({
  elements,
  minHeight,
}: {
  elements: ElementBase[];
  minHeight: number;
}) {
  return (
    <div style={{ position: "relative", minHeight }}>
      {elements.map((el) => (
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
          <ElementRenderer element={el} readonly />
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
  const ordered = elements
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
              <ElementRenderer
                element={el}
                readonly
                tokens={tokens as never}
              />
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
              <ElementRenderer
                element={el}
                readonly
                tokens={tokens as never}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
