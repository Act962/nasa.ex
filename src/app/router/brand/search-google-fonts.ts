import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { z } from "zod";

/**
 * Proxy pra Google Fonts API — usado pelo autocomplete de tipografia na
 * aba "Branding" do NASA Planner. Lista de fontes cacheada por 24h em
 * memory (~1500 fontes, ~200KB JSON).
 *
 * Por que proxy e não direto do client:
 *  1. Esconde a `GOOGLE_FONTS_API_KEY` (env var).
 *  2. Filtra/ranqueia client-side em PT-BR (categorias traduzidas).
 *  3. Cache server-side reduz rate-limit do Google.
 *
 * NÃO cobra STARs — Google Fonts é grátis. O autocomplete dispara em
 * cada keystroke (debounced no client), seria absurdo cobrar.
 */

interface GoogleFontItem {
  family: string;
  category: string; // "serif" | "sans-serif" | "display" | "handwriting" | "monospace"
  variants: string[];
  subsets: string[];
  files?: Record<string, string>;
}

interface GoogleFontsResponse {
  items: GoogleFontItem[];
}

interface CachedFonts {
  items: GoogleFontItem[];
  cachedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let cache: CachedFonts | null = null;

async function fetchAllFonts(apiKey: string): Promise<GoogleFontItem[]> {
  // Sort por "popularity" — fontes mais usadas no topo (Inter, Roboto,
  // etc.) — melhora a UX do autocomplete.
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Fonts API error: ${res.status}`);
  }
  const data = (await res.json()) as GoogleFontsResponse;
  return data.items ?? [];
}

async function getCachedFonts(): Promise<GoogleFontItem[]> {
  const now = Date.now();
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return cache.items;
  }
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    // Sem key — devolve fallback curado das 15 fontes mais comuns pra
    // não quebrar o autocomplete em dev.
    return FALLBACK_FONTS;
  }
  try {
    const items = await fetchAllFonts(apiKey);
    cache = { items, cachedAt: now };
    return items;
  } catch (err) {
    console.warn("[brand.searchGoogleFonts] fetch failed, using fallback", err);
    return cache?.items ?? FALLBACK_FONTS;
  }
}

const FALLBACK_FONTS: GoogleFontItem[] = [
  { family: "Inter", category: "sans-serif", variants: [], subsets: [] },
  { family: "Roboto", category: "sans-serif", variants: [], subsets: [] },
  { family: "Open Sans", category: "sans-serif", variants: [], subsets: [] },
  { family: "Lato", category: "sans-serif", variants: [], subsets: [] },
  { family: "Montserrat", category: "sans-serif", variants: [], subsets: [] },
  { family: "Poppins", category: "sans-serif", variants: [], subsets: [] },
  { family: "Source Sans 3", category: "sans-serif", variants: [], subsets: [] },
  { family: "Raleway", category: "sans-serif", variants: [], subsets: [] },
  { family: "Playfair Display", category: "serif", variants: [], subsets: [] },
  { family: "Cormorant Garamond", category: "serif", variants: [], subsets: [] },
  { family: "Merriweather", category: "serif", variants: [], subsets: [] },
  { family: "Lora", category: "serif", variants: [], subsets: [] },
  { family: "Bebas Neue", category: "display", variants: [], subsets: [] },
  { family: "Oswald", category: "sans-serif", variants: [], subsets: [] },
  { family: "Dancing Script", category: "handwriting", variants: [], subsets: [] },
];

export const searchGoogleFonts = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/brand/search-google-fonts",
    summary: "Search Google Fonts catalog (proxy, cached 24h)",
    tags: ["Brand"],
  })
  .input(
    z.object({
      query: z
        .string()
        .max(80)
        .default("")
        .describe("Termo pra filtrar por nome. Vazio = top 50 mais populares."),
      category: z
        .enum(["serif", "sans-serif", "display", "handwriting", "monospace"])
        .optional()
        .describe("Filtra por categoria. Omitir = todas."),
      limit: z.number().int().min(1).max(100).default(30),
    }),
  )
  .output(
    z.object({
      fonts: z.array(
        z.object({
          family: z.string(),
          category: z.string(),
        }),
      ),
      total: z.number().int(),
    }),
  )
  .handler(async ({ input }) => {
    const all = await getCachedFonts();
    const q = input.query.trim().toLowerCase();

    let filtered = all;
    if (input.category) {
      filtered = filtered.filter((f) => f.category === input.category);
    }
    if (q.length > 0) {
      filtered = filtered.filter((f) => f.family.toLowerCase().includes(q));
    }

    const sliced = filtered.slice(0, input.limit);
    return {
      fonts: sliced.map((f) => ({ family: f.family, category: f.category })),
      total: filtered.length,
    };
  });
