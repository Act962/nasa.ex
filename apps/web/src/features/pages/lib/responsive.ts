import { DEVICE_PRESETS } from "../constants";
import type { Device, ElementBase } from "../types";

const ARTBOARD_DEFAULT_WIDTH = 1440;
const FONT_SIZE_FLOOR = 12;

/**
 * Resolve um elemento para um determinado device.
 *
 * Retorna null  → elemento está oculto neste device (não deve ser renderizado).
 * Retorna el   → elemento com posições/tamanhos ajustados para o device.
 *
 * Prioridade de resolução:
 *   1. hiddenOn → ocultar (null)
 *   2. overrides manuais (responsive.tablet / responsive.mobile)
 *   3. auto-scale proporcional (deviceWidth / artboardWidth)
 *   4. desktop → retorna sem alterações
 */
export function resolveElement(
  el: ElementBase,
  device: Device,
  artboardWidth: number = ARTBOARD_DEFAULT_WIDTH,
): ElementBase | null {
  // 1. Oculto neste device
  if (el.responsive?.hiddenOn?.includes(device)) return null;

  // 2. Desktop — sem transform
  if (device === "desktop") return el;

  // 3. Override manual para o device
  const override = device === "mobile" ? el.responsive?.mobile : el.responsive?.tablet;
  if (override && Object.keys(override).length > 0) {
    return { ...el, ...override };
  }

  // 4. Auto-scale proporcional
  const targetWidth = DEVICE_PRESETS[device].width;
  const scale = targetWidth / artboardWidth;

  const scaled: ElementBase = {
    ...el,
    x: Math.round(el.x * scale),
    y: Math.round(el.y * scale),
    w: Math.round(el.w * scale),
    h: Math.round(el.h * scale),
  };

  if (typeof el.fontSize === "number") {
    scaled.fontSize = Math.max(FONT_SIZE_FLOOR, Math.round(el.fontSize * scale));
  }

  return scaled;
}

/**
 * Resolve todos os elementos de uma camada para um device.
 * Elementos ocultos (null) são filtrados.
 */
export function resolveElements(
  elements: ElementBase[],
  device: Device,
  artboardWidth: number = ARTBOARD_DEFAULT_WIDTH,
): ElementBase[] {
  return elements.flatMap((el) => {
    const resolved = resolveElement(el, device, artboardWidth);
    return resolved ? [resolved] : [];
  });
}

/** Determina o device a partir da largura do viewport. */
export function getDeviceFromWidth(width: number): Device {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
