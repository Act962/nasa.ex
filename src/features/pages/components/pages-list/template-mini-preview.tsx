"use client";

import { useEffect, useRef, useState } from "react";
import { applyTemplate, type PageTemplate } from "../../lib/page-templates";
import { isFlowSection } from "../../lib/section-flow";
import type { ElementType } from "../../types";
import { ElementRenderer } from "../elements/element-renderer";

/** Miniatura real do template: os primeiros blocos renderizados em escala pela largura do cartão. */

const TEMPLATE_RENDER_WIDTH_PX = 1280;
const MAX_PREVIEW_BLOCKS = 8;

export function TemplateMiniPreview({ template }: { template: PageTemplate }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    resizeObserver.observe(frame);
    return () => resizeObserver.disconnect();
  }, []);

  const appliedTemplate = applyTemplate(template.id);
  const flowElements = (appliedTemplate?.elements ?? [])
    .filter((element) => isFlowSection(element.type as ElementType))
    .sort((first, second) => (first.y ?? 0) - (second.y ?? 0))
    .slice(0, MAX_PREVIEW_BLOCKS);
  const scale = frameWidth / TEMPLATE_RENDER_WIDTH_PX;

  return (
    <div
      ref={frameRef}
      className="pointer-events-none relative aspect-[3/4] w-full overflow-hidden"
      style={{ background: template.tokens.bg }}
      aria-hidden
    >
      {flowElements.length === 0 ? (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${template.tokens.primary}40 0%, ${template.tokens.accent}20 100%)`,
          }}
        />
      ) : (
        scale > 0 && (
          <div
            className="absolute top-0 left-0"
            style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: TEMPLATE_RENDER_WIDTH_PX }}
          >
            {flowElements.map((element, index) => (
              <div key={element.id ?? index} className="w-full">
                <ElementRenderer
                  element={element}
                  readonly
                  tokens={appliedTemplate ? { colors: appliedTemplate.tokens } : undefined}
                />
              </div>
            ))}
          </div>
        )
      )}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}
