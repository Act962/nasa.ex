"use client";

/**
 * Renderer pro element type `"group"`.
 *
 * Grupos são containers "transparentes" — não desenham nada próprio,
 * apenas posicionam seus filhos relativamente ao bounding box do grupo.
 * Posição absoluta dos children é traduzida pra coordenadas relativas
 * (child.x - group.x, child.y - group.y) pra que mover o grupo no canvas
 * mova todos os filhos juntos sem mexer nas suas coords originais (no
 * unGroup eles voltam pra absolute idênticos).
 *
 * Esse componente serve tanto editor (canvas) quanto público (LandingFlow
 * não chega aqui porque já fez flatten antes — ver `layer-utils#flattenGroupsForRender`).
 */
import type { ElementBase, DesignTokens } from "../../types";
import { ElementRenderer } from "./element-renderer";

interface Props {
  element: ElementBase;
  readonly?: boolean;
  tokens?: DesignTokens;
}

export function GroupRenderer({ element, readonly, tokens }: Props) {
  const children = (element.children as ElementBase[] | undefined) ?? [];
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {children.map((child) => (
        <div
          key={child.id}
          data-el-id={child.id}
          style={{
            position: "absolute",
            left: child.x - element.x,
            top: child.y - element.y,
            width: child.w,
            height: child.h,
            transform: child.rotation ? `rotate(${child.rotation}deg)` : undefined,
            opacity: child.hidden ? 0 : child.opacity ?? 1,
            zIndex: child.zIndex ?? 1,
            pointerEvents: child.hidden ? "none" : undefined,
          }}
        >
          <ElementRenderer element={child} readonly={readonly} tokens={tokens} />
        </div>
      ))}
    </div>
  );
}
