import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { nanoid } from "nanoid";
import { z } from "zod";

/**
 * "Criar página similar" — recebe uma URL, faz fetch do HTML, extrai
 * elementos visíveis (título, h1, h2, parágrafos, imagens, botões) e
 * monta uma estrutura de blocos NasaPages aproximada.
 *
 * MVP: parsing super-simples via regex. Reconhece:
 *   - <title> e og:title → hero title
 *   - <meta name="description"> → hero subtitle
 *   - <h1>, <h2> → headings de sections
 *   - <img src> primeiras 3 → image references
 *   - <a class="btn|button"> → CTA labels
 *
 * Limitações conhecidas:
 *   - SPAs (React/Vue/etc) sem SSR retornam shell vazio
 *   - Sites com cloudflare/anti-bot bloqueiam o fetch
 *   - Layout não é preservado, só conteúdo textual
 *
 * Para uma versão futura: usar Puppeteer/Playwright pra renderizar
 * JS e extrair DOM real. Custo: ~5MB de dep + isolada em worker.
 */
export const cloneFromUrl = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      url: z.string().url(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    // Fetch com User-Agent realista — alguns sites bloqueiam fetch sem UA.
    let html: string;
    try {
      const res = await fetch(input.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      html = await res.text();
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: `Não conseguimos acessar essa URL: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      });
    }

    // ── Extração ─────────────────────────────────────────────────
    const extract = (rx: RegExp): string[] =>
      Array.from(html.matchAll(rx))
        .map((m) => decodeEntities(stripTags(m[1] ?? "")))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // ⚠ `html.matchAll(rx)` exige regex global. SEM `g` lança
    // TypeError em runtime ("matchAll called with a non-global
    // RegExp argument") → 500. Por isso TODAS as regex aqui têm
    // flag `g` (e `i` quando case-insensitive).
    const title =
      extract(/<title[^>]*>([^<]+)<\/title>/gi)[0] ??
      extract(/property=["']og:title["']\s+content=["']([^"']+)["']/gi)[0] ??
      "Site importado";

    const description =
      extract(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/gi)[0] ??
      extract(/property=["']og:description["']\s+content=["']([^"']+)["']/gi)[0] ??
      "";

    const h1List = extract(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    const h2List = extract(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
    const buttonLabels = extract(
      /<(?:a|button)[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|button)>/gi,
    );

    // Captura <img src>, og:image e background-image inline.
    // og:image costuma ser a imagem hero do site (boa pra usar como
    // backgroundImage do hero do template clonado).
    const ogImage =
      extract(/property=["']og:image["']\s+content=["']([^"']+)["']/gi)[0] ??
      "";
    const inlineBgUrls = Array.from(
      html.matchAll(
        /background(?:-image)?\s*:\s*url\(["']?(https?:\/\/[^)"']+)["']?\)/gi,
      ),
    )
      .map((m) => m[1])
      .filter(Boolean);
    const imgSrcUrls = Array.from(
      html.matchAll(/<img[^>]*src=["'](https?:\/\/[^"']+\.(?:png|jpg|jpeg|webp))["']/gi),
    )
      .map((m) => m[1])
      .filter(Boolean);
    // Junta tudo, dedupa, primeira sempre o og:image (melhor candidata
    // pra background do hero) se existir.
    const imageUrls = Array.from(
      new Set(
        [ogImage, ...inlineBgUrls, ...imgSrcUrls].filter(Boolean),
      ),
    ).slice(0, 5);

    // ── Detecta cores predominantes (heurística simples) ──────────
    const hexColors = Array.from(html.matchAll(/#[0-9a-fA-F]{6}/g))
      .map((m) => m[0].toUpperCase())
      .reduce(
        (acc, c) => {
          acc[c] = (acc[c] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    const sortedColors = Object.entries(hexColors)
      .sort(([, a], [, b]) => b - a)
      .map(([c]) => c)
      .filter((c) => c !== "#FFFFFF" && c !== "#000000");
    const detectedPrimary = sortedColors[0] ?? "#7C3AED";

    // ── Monta tokens + elementos pre-applied ─────────────────────
    const tokens = {
      colors: {
        primary: detectedPrimary,
        accent: sortedColors[1] ?? detectedPrimary,
        bg: "#0a0a0a",
        fg: "#f8fafc",
        muted: "#94a3b8",
      },
    };

    const T = tokens.colors;
    let nextY = 0;
    const pushAt = (
      el: Record<string, unknown> & { h: number },
    ): Record<string, unknown> => {
      const out = {
        ...el,
        id: `el_${nanoid(10)}`,
        x: 0,
        y: nextY,
      };
      nextY += el.h;
      return out;
    };
    const tokenColors = {
      bgColor: T.bg,
      fgColor: T.fg,
      primaryColor: T.primary,
      mutedColor: T.muted,
    };

    // ── Detecção rica de sections ───────────────────────────────────
    // Quebra o HTML em "blocos de section" (`<section>`, `<div
    // class="section/block/row/container">` com h2 dentro), extrai
    // headings + textos + listas e classifica em tipos NASA.
    // Cada extractor é safe — se quebrar, retorna array vazio em vez
    // de derrubar o handler inteiro com 500.
    const safe = <T>(fn: () => T, fallback: T, label: string): T => {
      try {
        return fn();
      } catch (err) {
        console.warn(`[clone-from-url] ${label} extraction failed`, err);
        return fallback;
      }
    };
    const sections = safe(() => splitIntoSections(html), [], "sections");
    const detectedFaqs = safe(() => extractFaqs(html), [], "faqs");
    const detectedTestimonials = safe(
      () => extractTestimonials(html),
      [],
      "testimonials",
    );
    const detectedPricing = safe(() => extractPricing(html), [], "pricing");
    const detectedStats = safe(() => extractStats(html), [], "stats");

    // ── Monta layout ───────────────────────────────────────────────
    const elements: Record<string, unknown>[] = [];

    // 1. Navbar — usa as primeiras 4-5 sections "geradoras de bloco"
    // como âncoras (skipa FAQ/depoimentos/pricing porque esses vão
    // pra blocos com anchorIds fixos: #faq #planos etc.).
    const navbarSkip = [
      "depoiment",
      "testimonial",
      "faq",
      "duvida",
      "dúvida",
      "perguntas",
      "preço",
      "preco",
      "plano",
      "pricing",
      "valor",
      "footer",
      "rodapé",
    ];
    const navbarLinks = sections
      .filter((s) => {
        if (!s.heading) return false;
        const low = s.heading.toLowerCase();
        return !navbarSkip.some((k) => low.includes(k));
      })
      .slice(0, 4)
      .map((s, i) => ({
        id: `l${i}`,
        label: s.heading.slice(0, 22),
        href: `#${s.anchorId}`,
      }));
    // Sempre adiciona "Planos" e "FAQ" se vai gerar esses blocos
    if (detectedPricing.length >= 2) {
      navbarLinks.push({ id: "lp", label: "Planos", href: "#planos" });
    }
    if (detectedFaqs.length >= 2) {
      navbarLinks.push({ id: "lf", label: "FAQ", href: "#faq" });
    }

    elements.push(
      pushAt({
        type: "section-navbar",
        w: 1200,
        h: 80,
        logoText:
          title.split(/[—|·,-]/)[0]?.trim().slice(0, 20) ?? "Logo",
        links: navbarLinks.slice(0, 6),
        primaryCta: buttonLabels[0]?.slice(0, 30) ?? "Quero participar",
        primaryCtaHref: "#cta-final",
        secondaryCta: "Entrar",
        secondaryCtaHref: "#",
        ...tokenColors,
      }),
    );

    // 2. Hero — bg full-bleed
    elements.push(
      pushAt({
        type: "section-hero",
        w: 1200,
        h: 640,
        badge: "★ Importado de " + new URL(input.url).hostname,
        titleLine1: (h1List[0] ?? title).slice(0, 80),
        titleLine2: (h1List[1] ?? "").slice(0, 60),
        subtitle: description.slice(0, 240),
        primaryCta: buttonLabels[0]?.slice(0, 30) ?? "Começar agora",
        primaryCtaHref: "#cta-final",
        secondaryCta: buttonLabels[1]?.slice(0, 30) ?? "Saber mais",
        secondaryCtaHref: "#",
        backgroundImage: imageUrls[0] ?? "",
        backgroundOverlay:
          "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%)",
        imageUrl: "",
        ...tokenColors,
      }),
    );

    // 3. Stats (se detectado)
    if (detectedStats.length >= 2) {
      elements.push(
        pushAt({
          type: "section-stats",
          w: 1200,
          h: 180,
          stats: detectedStats.slice(0, 4).map((s, i) => ({
            id: `s${i}`,
            value: s.value,
            label: s.label,
          })),
          ...tokenColors,
        }),
      );
    }

    // 4. Sections detectadas → features (cards) ou content visual
    // Pula a primeira (que vira hero) e cada section vira um bloco
    // de features se tem >=2 sub-cards, senão vira "features de 1 card"
    // com texto longo + imagem se possível.
    const usedSections = new Set<number>();
    const skipKeywords = [
      "depoiment",
      "testimonial",
      "faq",
      "duvida",
      "dúvida",
      "perguntas",
      "preço",
      "preco",
      "plano",
      "pricing",
      "valor",
      "footer",
      "rodapé",
    ];
    sections.forEach((s, idx) => {
      if (idx === 0) return; // hero
      if (!s.heading) return;
      // Skip se já vai virar outro bloco semântico
      const lower = s.heading.toLowerCase();
      if (skipKeywords.some((k) => lower.includes(k))) return;
      usedSections.add(idx);

      // Decide tipo de bloco:
      // - >=2 cards (h3/li) → features grid
      // - texto longo + imagem → features 1 card grande (acts like about)
      if (s.cards.length >= 2) {
        elements.push(
          pushAt({
            type: "section-features",
            w: 1200,
            h: 500,
            anchorId: s.anchorId,
            heading: s.heading.slice(0, 80),
            subheading: (s.subheading ?? "").slice(0, 200),
            features: s.cards.slice(0, 6).map((c, i) => ({
              id: `f${idx}${i}`,
              icon:
                ["🎯", "⚡", "🛡", "🚀", "✨", "💎", "🔥", "⭐"][i] ?? "•",
              title: c.title.slice(0, 60),
              description: c.body.slice(0, 200),
            })),
            ...tokenColors,
          }),
        );
      } else if (s.bodyText.length > 80) {
        // Card único — usar features com 1 item pra ficar visual
        elements.push(
          pushAt({
            type: "section-features",
            w: 1200,
            h: 380,
            anchorId: s.anchorId,
            heading: s.heading.slice(0, 80),
            subheading: s.bodyText.slice(0, 300),
            features: [
              {
                id: `f${idx}_0`,
                icon: "📌",
                title: s.subheading?.slice(0, 60) ?? s.heading.slice(0, 60),
                description: s.bodyText.slice(0, 240),
              },
            ],
            ...tokenColors,
          }),
        );
      }
    });

    // 5. Testimonials (se detectados)
    if (detectedTestimonials.length > 0) {
      elements.push(
        pushAt({
          type: "section-testimonials",
          w: 1200,
          h: 460,
          heading: "Depoimentos",
          testimonials: detectedTestimonials.slice(0, 6).map((t, i) => ({
            id: `t${i}`,
            quote: t.quote,
            author: t.author,
            role: t.role ?? "",
            avatar: `https://i.pravatar.cc/120?img=${(i + 1) * 7}`,
          })),
          ...tokenColors,
        }),
      );
    }

    // 6. Pricing (se detectado)
    if (detectedPricing.length >= 2) {
      elements.push(
        pushAt({
          type: "section-pricing",
          w: 1200,
          h: 640,
          anchorId: "planos",
          heading: "Planos",
          subheading: "Escolha o que faz mais sentido pra você",
          plans: detectedPricing.slice(0, 3).map((p, i) => ({
            id: `p${i}`,
            name: p.name,
            price: p.price,
            period: p.period ?? "",
            slogan: p.slogan ?? "",
            features: p.features.slice(0, 6),
            ctaLabel: "Quero esse plano",
            highlighted: i === 1, // meio destacado
          })),
          ...tokenColors,
        }),
      );
    }

    // 7. FAQ (se detectado)
    if (detectedFaqs.length >= 2) {
      elements.push(
        pushAt({
          type: "section-faq",
          w: 1200,
          h: 520,
          anchorId: "faq",
          heading: "Perguntas frequentes",
          items: detectedFaqs.slice(0, 10).map((f, i) => ({
            id: `q${i}`,
            question: f.question,
            answer: f.answer,
          })),
          ...tokenColors,
        }),
      );
    }

    // 8. CTA final
    elements.push(
      pushAt({
        type: "section-cta",
        w: 1200,
        h: 460,
        anchorId: "cta-final",
        heading: (h1List[0] ?? title).slice(0, 60),
        headingAccent: "É agora.",
        subtitle:
          description.slice(0, 200) ||
          "Importado com sucesso. Edite no builder.",
        primaryCta: buttonLabels[0]?.slice(0, 30) ?? "Quero participar",
        primaryCtaHref: "#",
        secondaryCta: "Falar com a gente",
        secondaryCtaHref: "#",
        ...tokenColors,
      }),
    );

    // 9. Footer
    elements.push(
      pushAt({
        type: "section-footer",
        w: 1200,
        h: 180,
        logoText:
          title.split(/[—|·,-]/)[0]?.trim().slice(0, 20) ?? "Logo",
        tagline: description.slice(0, 120),
        copyright: `Importado de ${new URL(input.url).hostname} · © ${new Date().getFullYear()}`,
        links: [
          { id: "1", label: "Política de Privacidade", href: "#" },
          { id: "2", label: "Termos", href: "#" },
          { id: "3", label: "Contato", href: "#" },
        ],
        bgColor: T.bg,
        fgColor: T.fg,
        mutedColor: T.muted,
      }),
    );

    // Audit log
    try {
      await logActivity({
        organizationId,
        userId: context.user.id,
        userName: context.user.name ?? "Usuário",
        userEmail: context.user.email ?? "",
        userImage: (context.user as { image?: string | null }).image ?? undefined,
        appSlug: "nasa-pages",
        action: "nasa_pages.cloned_from_url",
        actionLabel: `Importou página semelhante de "${new URL(input.url).hostname}"`,
        resource: input.url,
        resourceId: undefined,
        metadata: { sourceUrl: input.url, blocksGenerated: elements.length },
      });
    } catch (err) {
      console.warn("[clone-from-url] activity log failed", err);
    }

    return {
      title,
      description,
      tokens,
      elements,
      sourceUrl: input.url,
      detectedColors: sortedColors.slice(0, 5),
      // Debug counters — úteis pro user entender o que foi extraído
      stats: {
        sectionsDetected: sections.length,
        blocksGenerated: elements.length,
        faqs: detectedFaqs.length,
        testimonials: detectedTestimonials.length,
        pricing: detectedPricing.length,
        statBlocks: detectedStats.length,
        imagesFound: imageUrls.length,
      },
    };
  });

// ── Helpers ──────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

function clean(s: string): string {
  return decodeEntities(stripTags(s))
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string): string {
  // ̀-ͯ = bloco "Combining Diacritical Marks" (NFD decompõe
  // acentos em letra-base + diacrítico → removemos só o diacrítico).
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

// ── Section detection ────────────────────────────────────────────
// Divide o HTML em "blocos lógicos de section" e por cada bloco
// extrai: heading principal (h2 mais próximo), subheading (h3
// seguinte ou primeiro <p>), bodyText (junção de todos os <p>),
// cards (h3 ou <li> com texto >20 chars). Não é parser AST — é
// regex tolerante a HTML real.

type DetectedSection = {
  anchorId: string;
  heading: string;
  subheading?: string;
  bodyText: string;
  cards: Array<{ title: string; body: string }>;
};

function splitIntoSections(html: string): DetectedSection[] {
  // Foca no <body> pra ignorar head/script
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch?.[1] ?? html;

  // Quebra por <section> ou divs com classes típicas. Se o site
  // não usa <section> semântico, cai num fallback que quebra por
  // <h2> consecutivos.
  const sectionRx = /<(?:section|main|article)[^>]*>([\s\S]*?)<\/(?:section|main|article)>/gi;
  const blocks = Array.from(bodyHtml.matchAll(sectionRx))
    .map((m) => m[1])
    .filter((b) => b && b.length > 200);

  // Fallback: quebra por h2 se < 3 sections encontradas
  const blocksFinal =
    blocks.length >= 3 ? blocks : splitByH2(bodyHtml);

  const out: DetectedSection[] = [];
  const seenHeadings = new Set<string>();

  for (const block of blocksFinal) {
    const headingMatch = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const heading = headingMatch ? clean(headingMatch[1]) : "";
    if (!heading || heading.length < 3) continue;
    const key = heading.toLowerCase();
    if (seenHeadings.has(key)) continue;
    seenHeadings.add(key);

    // Subheading: h3 ou primeiro p
    const h3Match = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const firstP = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const subheading = h3Match
      ? clean(h3Match[1])
      : firstP
        ? clean(firstP[1]).slice(0, 240)
        : undefined;

    // Body text: junção dos primeiros 3 <p>
    const ps = Array.from(block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => clean(m[1]))
      .filter((p) => p.length > 20)
      .slice(0, 3);
    const bodyText = ps.join(" ");

    // Cards: h3s seguintes (depois do primeiro) ou <li> com >20 chars
    const h3s = Array.from(block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi))
      .map((m) => clean(m[1]))
      .filter((t) => t.length > 3);
    const lis = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
      .map((m) => clean(m[1]))
      .filter((t) => t.length > 20 && t.length < 240);

    // Prefere h3s como cards (têm título mais limpo)
    const cardSources = h3s.length >= 2 ? h3s : lis;
    const cards = cardSources.slice(0, 8).map((title, i) => ({
      title: title.slice(0, 80),
      // tenta achar p logo depois do h3 desse card no original
      body: ps[i + 1]?.slice(0, 200) ?? "",
    }));

    out.push({
      anchorId: slugify(heading) || `sec-${out.length}`,
      heading,
      subheading,
      bodyText,
      cards,
    });
  }

  return out;
}

function splitByH2(html: string): string[] {
  const parts = html.split(/(?=<h2)/gi);
  return parts.filter((p) => p.length > 200);
}

// ── FAQ detection ────────────────────────────────────────────────
// Detecta padrões: <details><summary>, <dt>/<dd>, ou h3+p próximos
// dentro de uma section com "faq"/"perguntas"/"dúvidas" no contexto.
function extractFaqs(
  html: string,
): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];

  // <details><summary>Q</summary>A</details>
  const detailsRx =
    /<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  for (const m of html.matchAll(detailsRx)) {
    const q = clean(m[1]);
    const a = clean(m[2]);
    if (q.length > 5 && a.length > 5) out.push({ question: q, answer: a });
  }

  // <dt>Q</dt><dd>A</dd>
  if (out.length === 0) {
    const dtDdRx =
      /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    for (const m of html.matchAll(dtDdRx)) {
      const q = clean(m[1]);
      const a = clean(m[2]);
      if (q.length > 5 && a.length > 5)
        out.push({ question: q, answer: a });
    }
  }

  // Fallback: h3 que TERMINAM com "?" + próximo <p>
  if (out.length === 0) {
    const sections = html.split(/(?=<h2)/gi);
    const faqSection = sections.find((s) =>
      /faq|perguntas|d[uú]vidas/i.test(s.slice(0, 500)),
    );
    if (faqSection) {
      const pairs = Array.from(
        faqSection.matchAll(
          /<h[3-4][^>]*>([\s\S]*?)<\/h[3-4]>\s*(?:<[^>]+>\s*)?<p[^>]*>([\s\S]*?)<\/p>/gi,
        ),
      );
      for (const m of pairs) {
        const q = clean(m[1]);
        const a = clean(m[2]);
        if (q.length > 5 && a.length > 5)
          out.push({ question: q, answer: a });
      }
    }
  }

  return out.slice(0, 12);
}

// ── Testimonials ─────────────────────────────────────────────────
// Padrões: <blockquote>, citações com — nome, ou sections com
// "depoimento"/"testimonial"/"o que dizem"
function extractTestimonials(
  html: string,
): Array<{ quote: string; author: string; role?: string }> {
  const out: Array<{ quote: string; author: string; role?: string }> = [];

  // <blockquote> + <cite> ou <footer>
  const bqRx =
    /<blockquote[^>]*>([\s\S]*?)(?:<(?:cite|footer)[^>]*>([\s\S]*?)<\/(?:cite|footer)>)?[\s\S]*?<\/blockquote>/gi;
  for (const m of html.matchAll(bqRx)) {
    const q = clean(m[1]);
    const a = clean(m[2] ?? "");
    if (q.length > 20)
      out.push({
        quote: q.slice(0, 220),
        author: a || "Cliente satisfeito",
      });
  }

  // Fallback: section com keyword + cards (h3 + p curto + nome)
  if (out.length === 0) {
    const sections = html.split(/(?=<h2)/gi);
    const testSection = sections.find((s) =>
      /depoiment|testimonial|o que dizem|alunas|alunos/i.test(
        s.slice(0, 500),
      ),
    );
    if (testSection) {
      const cards = Array.from(
        testSection.matchAll(
          /<p[^>]*>(["“"][\s\S]*?["”"])<\/p>(?:[\s\S]{0,200}?<(?:strong|b|h[3-5])[^>]*>([\s\S]*?)<\/(?:strong|b|h[3-5])>)?/gi,
        ),
      );
      for (const m of cards) {
        const q = clean(m[1]).replace(/^["“"]|["”"]$/g, "");
        const a = clean(m[2] ?? "");
        if (q.length > 30)
          out.push({
            quote: q.slice(0, 220),
            author: a || "Aluna",
          });
      }
    }
  }

  return out.slice(0, 6);
}

// ── Pricing ──────────────────────────────────────────────────────
// Detecta: section com "plano"/"preço"/"pricing", cards com preço
// (R$ XXX ou $XXX) + nome de plano + lista de features.
function extractPricing(html: string): Array<{
  name: string;
  price: string;
  period?: string;
  slogan?: string;
  features: string[];
}> {
  const out: Array<{
    name: string;
    price: string;
    period?: string;
    slogan?: string;
    features: string[];
  }> = [];

  const sections = html.split(/(?=<h2)/gi);
  const pricingSection = sections.find((s) =>
    /plano|pre[çc]o|pricing|invest|valor/i.test(s.slice(0, 500)),
  );
  if (!pricingSection) return out;

  // Cada "plano" geralmente é um <div class="plan/card"> ou similar
  // contendo um <h3> (nome) + texto com R$ + <ul><li>
  const cardBlocks = Array.from(
    pricingSection.matchAll(
      /<(?:div|article|section)[^>]*(?:class|id)=["'][^"']*(?:plan|tier|price|card|pricing)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section)>/gi,
    ),
  ).map((m) => m[1]);

  const candidates =
    cardBlocks.length >= 2
      ? cardBlocks
      : // Fallback: divide por h3 dentro da pricing section
        pricingSection.split(/(?=<h3)/gi).filter((p) => /R\$|\$/.test(p));

  for (const card of candidates) {
    const nameMatch = card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
    const name = nameMatch ? clean(nameMatch[1]).slice(0, 30) : "";
    if (!name) continue;
    // R$ 1.234 ou R$1234,00 ou $99 etc
    const priceMatch = card.match(
      /(R\$\s*[\d.,]+|US\$\s*[\d.,]+|\$\s*[\d.,]+|€\s*[\d.,]+)/i,
    );
    const price = priceMatch ? priceMatch[1].trim() : "";
    if (!price) continue;
    // Período (à vista / mês / ano)
    const periodMatch = card.match(
      /(\/(?:m[eê]s|ano|mensal|anual)|à\s*vista|por mês|por ano|12x)/i,
    );
    const period = periodMatch ? periodMatch[1].trim() : "";
    // Features (<li>)
    const features = Array.from(card.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
      .map((m) => clean(m[1]))
      .filter((t) => t.length > 4 && t.length < 120)
      .slice(0, 8);

    out.push({
      name,
      price,
      period,
      features: features.length > 0 ? features : ["Acesso completo"],
    });
  }

  return out.slice(0, 4);
}

// ── Stats ────────────────────────────────────────────────────────
// Detecta números proeminentes seguidos de label (ex: "+500 Alunas",
// "98% Satisfação", "15k+ Procedimentos")
function extractStats(html: string): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const text = clean(html);

  // Pattern: número opcional+símbolo + label de até 30 chars
  const rx =
    /(\+?\d[\d.,]*(?:k|K|M|mil|%|\+|x)?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\s]{3,28}?)(?=\s+\+?\d|\s+[A-Z]{2,}|[.!])/g;
  for (const m of text.matchAll(rx)) {
    const value = m[1].trim();
    const label = m[2].trim();
    if (value.length > 1 && label.length > 3 && label.length < 30) {
      out.push({ value, label });
    }
    if (out.length >= 6) break;
  }

  // Dedup por label
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = s.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
