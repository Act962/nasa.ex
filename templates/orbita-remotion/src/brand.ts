import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { getAvailableFonts } from "@remotion/google-fonts";

/** Marca vinda do Kit da Marca do ÓRBITA (tool MCP `get_video_templates` → `brand`). */
export type Brand = {
  brandName: string;
  handle?: string | null;
  palette: string[];
  logoUrl?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  website?: string | null;
};

export const DEFAULT_BRAND: Brand = {
  brandName: "ÓRBITA",
  handle: "@orbitahub",
  palette: ["#05070D", "#009EF7", "#FFFFFF"],
  logoUrl: null,
  fontHeading: "Sora",
  fontBody: "Inter",
};

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

function luminance(hex: string) {
  const match = hex.match(HEX_PATTERN);
  if (!match) return 0;
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Fundo = cor mais escura da paleta, destaque = cor mais saturada que não é o fundo, texto = contraste. */
export function brandColors(brand: Brand) {
  const palette = brand.palette.filter((color) => HEX_PATTERN.test(color)).map((color) => (color.startsWith("#") ? color : `#${color}`));
  const colors = palette.length ? palette : DEFAULT_BRAND.palette;
  const byLuminance = [...colors].sort((first, second) => luminance(first) - luminance(second));
  const background = byLuminance[0];
  const accent = colors.find((color) => color !== background && luminance(color) > 0.08 && luminance(color) < 0.85) ?? colors[1] ?? "#009EF7";
  const text = luminance(background) > 0.5 ? "#0A0A0A" : "#FFFFFF";
  return { background, accent, text, muted: text === "#FFFFFF" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)" };
}

const FALLBACK_STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const fontCache = new Map<string, Promise<string>>();

async function loadGoogleFont(family: string): Promise<string> {
  const entry = getAvailableFonts().find((font) => font.fontFamily.toLowerCase() === family.toLowerCase());
  if (!entry) return FALLBACK_STACK;
  const fontModule = await entry.load();
  const loaded = fontModule.loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin", "latin-ext"] } as never);
  await loaded.waitUntilDone();
  return `${loaded.fontFamily}, ${FALLBACK_STACK}`;
}

/** Carrega a fonte do Kit no Google Fonts; se não existir lá, usa a fonte do sistema. */
export function useBrandFont(family: string | null | undefined) {
  const [fontFamily, setFontFamily] = useState(FALLBACK_STACK);
  const [handle] = useState(() => (family ? delayRender(`fonte ${family}`) : null));
  useEffect(() => {
    if (!family || handle === null) return;
    if (!fontCache.has(family)) fontCache.set(family, loadGoogleFont(family).catch(() => FALLBACK_STACK));
    fontCache.get(family)!.then((resolved) => {
      setFontFamily(resolved);
      continueRender(handle);
    });
  }, [family, handle]);
  return fontFamily;
}

export function useBrandFonts(brand: Brand) {
  const heading = useBrandFont(brand.fontHeading);
  const body = useBrandFont(brand.fontBody ?? brand.fontHeading);
  return { heading, body };
}
