"use client";

/**
 * Sistema de "blocos intermediários" — mini-elementos que o user pode
 * inserir DENTRO de uma section composta (testimonials/features/faq/etc),
 * em 3 zonas semânticas: ANTES do heading, ENTRE heading e cards, DEPOIS
 * dos cards.
 *
 * Tipos suportados (cobrem 95% dos casos sem reimportar o ElementRenderer
 * pesado):
 *   - `text`: texto livre com TextStyle completo
 *   - `image`: imagem com width/height/borderRadius
 *   - `button`: CTA com link (URL/âncora) + cores
 *   - `divider`: linha horizontal com cor + thickness
 *   - `spacer`: espaço vertical em px
 *   - `badge`: pill/tag com texto + cor
 *
 * O JSON fica como `element.interludeBlocks?: { aboveHeading?, betweenHeadingAndCards?, afterCards?: InterludeBlock[] }`.
 * `renderInterludeBlocks()` é o entry point que itera e renderiza.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ElementBase } from "../../../types";
import {
  type TextStyle,
  textStyleToCSS,
  resolveTextStyle,
} from "../../../lib/text-style";

// Import dinâmico do ElementRenderer pra quebrar o ciclo de módulos
// (element-renderer → sections/* → interlude-block → element-renderer).
// `next/dynamic` resolve no client + SSR sem problemas.
const ElementRendererDynamic = dynamic(
  () =>
    import("../element-renderer").then((m) => ({
      default: m.ElementRenderer,
    })),
  { ssr: true },
);

export type InterludeBlockKind =
  // Wrapper genérico — carrega um ElementBase inteiro e renderiza com
  // o ElementRenderer normal. Permite que QUALQUER tipo de elemento
  // (social, icon, spacer, group, etc) seja inserido dentro de uma
  // section como interlude block sem precisar mapear caso a caso.
  // Usado pelo fallback do `mapElementToInterludeBlock`.
  | "inline-element"
  | OriginalKind;

type OriginalKind =
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "badge"
  | "video"
  | "embed"
  | "carousel";

export interface InterludeCarouselSlide {
  id: string;
  imageUrl?: string;
  caption?: string;
  /** Texto alternativo pra acessibilidade. */
  alt?: string;
  /** Link opcional ao clicar no slide. URL absoluta ou âncora "#x". */
  link?: string;
  /** Override de proporção por slide (ex: "16:9", "1:1", "4:3", "free"). */
  aspectRatio?: string;
}

export interface InterludeBlock {
  id: string;
  kind: InterludeBlockKind;
  // text / badge — `text` é o campo compartilhado
  text?: string;
  textStyle?: TextStyle;
  // image / video thumbnail
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  // button
  label?: string;
  href?: string;
  bg?: string;
  fg?: string;
  // divider
  color?: string;
  thickness?: number;
  // spacer
  spaceHeight?: number;
  // badge
  badgeBg?: string;
  badgeColor?: string;
  // video
  videoProvider?: "yt" | "vimeo" | "mp4";
  videoUrl?: string;
  // embed (HTML cru)
  embedHtml?: string;
  // carousel — mesmo padrão do elemento Carrossel principal.
  // `slides` é a lista; demais campos espelham `element.imageMode/etc`.
  slides?: InterludeCarouselSlide[];
  /** Modo "static" (grid) vs "slide" (autoplay horizontal). Default "slide". */
  carouselMode?: "static" | "slide";
  /** Slides visíveis por viewport em desktop. Default 3. */
  slidesPerView?: number;
  /** Slides em mobile (default = max(1, perView/2)). */
  slidesPerViewMobile?: number;
  /** Auto-rotação ligada (default true). */
  autoplay?: boolean;
  /** Intervalo do auto-slide em ms (default 4000). */
  intervalMs?: number;
  /** Mostra dots de navegação. Default true. */
  showDots?: boolean;
  /** Mostra setas prev/next. Default true. */
  showArrows?: boolean;
  /** Espaço entre slides (px). Default 12. */
  gap?: number;
  /** Modo de exibição das imagens: uniform = altura fixa,
   *  original = proporção natural, custom = w/h explícito. Default "uniform". */
  imageMode?: "uniform" | "original" | "custom";
  /** Altura das imagens em modo uniform/custom. Default 240. */
  imageHeight?: number;
  /** Largura das imagens em modo custom. Default 320. */
  imageWidth?: number;
  /** Cor de fundo do wrapper do carrossel. Aceita hex/rgba. Quando
   *  `backgroundTransparent` for true, ignora esse campo. */
  backgroundColor?: string;
  /** Quando true, wrapper SEM cor de fundo (transparente). Default true. */
  backgroundTransparent?: boolean;
  /** Padding interno do wrapper (px). Default 0 (sem padding). */
  backgroundPadding?: number;
  // ── kind "inline-element": wrapper genérico ──
  /** ElementBase serializado — carregado pelo InterludeBlockView via
   *  ElementRenderer normal. Permite reutilizar 100% da lógica de
   *  qualquer tipo (social, icon, spacer, etc) sem mapeamento dedicado. */
  inlineElement?: Record<string, unknown>;
}

export interface InterludeZones {
  aboveHeading?: InterludeBlock[];
  betweenHeadingAndCards?: InterludeBlock[];
  afterCards?: InterludeBlock[];
}

/**
 * Renderiza uma lista de blocos numa zona. Cada bloco é envolvido por
 * um wrapper que dá margem vertical pequena pra respiro. Renderer puro
 * — server-safe.
 */
export function RenderInterludeBlocks({
  blocks,
}: {
  blocks: InterludeBlock[] | undefined;
}) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {blocks.map((block) => (
        <InterludeBlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

function InterludeBlockView({ block }: { block: InterludeBlock }) {
  switch (block.kind) {
    case "text": {
      const merged = resolveTextStyle(undefined, block.textStyle, {
        color: "inherit",
        fontSize: 16,
        align: "center",
        lineHeight: 1.5,
      });
      return (
        <p style={{ ...textStyleToCSS(merged), maxWidth: 720 }}>
          {block.text ?? ""}
        </p>
      );
    }
    case "image": {
      if (!block.src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.alt ?? ""}
          style={{
            width: block.width ?? "auto",
            height: block.height ?? "auto",
            maxWidth: "100%",
            borderRadius: block.borderRadius ?? 0,
            objectFit: "cover",
          }}
        />
      );
    }
    case "button": {
      return (
        <a
          href={block.href ?? "#"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 24px",
            background: block.bg ?? "#6366f1",
            color: block.fg ?? "#fff",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          {block.label ?? "Clique"}
        </a>
      );
    }
    case "divider": {
      return (
        <div
          style={{
            width: "min(100%, 480px)",
            height: block.thickness ?? 1,
            background: block.color ?? "currentColor",
            opacity: 0.2,
          }}
        />
      );
    }
    case "spacer": {
      return <div style={{ height: block.spaceHeight ?? 24 }} />;
    }
    case "badge": {
      return (
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: block.badgeBg ?? "#6366f120",
            color: block.badgeColor ?? "#6366f1",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {block.text ?? "BADGE"}
        </span>
      );
    }
    case "video": {
      const url = block.videoUrl ?? "";
      const provider = block.videoProvider ?? "yt";
      if (!url) {
        return (
          <div className="w-full max-w-2xl rounded border-2 border-dashed p-6 text-center text-xs text-muted-foreground">
            Configure a URL do vídeo no editor
          </div>
        );
      }
      const w = block.width ?? 560;
      const h = block.height ?? 315;
      if (provider === "mp4") {
        return (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={url}
            controls
            style={{
              width: w,
              height: h,
              maxWidth: "100%",
              borderRadius: block.borderRadius ?? 12,
              background: "#000",
            }}
          />
        );
      }
      const src = provider === "yt" ? toYoutubeEmbed(url) : toVimeoEmbed(url);
      return (
        <iframe
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            width: w,
            height: h,
            maxWidth: "100%",
            border: 0,
            borderRadius: block.borderRadius ?? 12,
          }}
        />
      );
    }
    case "embed": {
      const html = block.embedHtml ?? "";
      if (!html) {
        return (
          <div className="w-full max-w-2xl rounded border-2 border-dashed p-6 text-center text-xs text-muted-foreground">
            Cole código HTML/embed no editor
          </div>
        );
      }
      return (
        <div
          style={{
            width: block.width ?? "100%",
            maxWidth: "100%",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case "carousel":
      // Renderer dedicado — usa mesmo padrão do `CarouselElement`
      // (estados de idx + perView responsivo + dots/arrows/autoplay).
      // É client component porque precisa de useState/useEffect.
      return <InterludeCarousel block={block} />;
    case "inline-element": {
      // Renderer genérico — carrega o ElementBase armazenado no block
      // e delega pro ElementRenderer normal (via import dinâmico, pra
      // quebrar o ciclo de módulos). Render é "transparente": não
      // aplicamos posicionamento absoluto (x/y do block original são
      // ignorados), só largura natural do elemento. Isso é intencional:
      // dentro de uma section composta, queremos fluxo vertical normal.
      if (!block.inlineElement) return null;
      const fakeElement = {
        ...block.inlineElement,
        // Anula posição absoluta — vamos respirar no fluxo da section.
        x: 0,
        y: 0,
      } as ElementBase;
      return (
        <div
          style={{
            width: (block.inlineElement.w as number | undefined) ?? "100%",
            maxWidth: "100%",
          }}
        >
          <ElementRendererDynamic element={fakeElement} readonly />
        </div>
      );
    }
    default:
      return null;
  }
}

function toYoutubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

function toVimeoEmbed(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
}

/** Cria um novo bloco com defaults sensatos pro `kind` escolhido. */
export function createInterludeBlock(kind: InterludeBlockKind): InterludeBlock {
  const id = `ib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  switch (kind) {
    case "text":
      return { id, kind, text: "Texto intermediário" };
    case "image":
      return { id, kind, src: "", alt: "", width: 320, borderRadius: 8 };
    case "button":
      return { id, kind, label: "Botão", href: "#", bg: "#6366f1", fg: "#fff" };
    case "divider":
      return { id, kind, thickness: 1 };
    case "spacer":
      return { id, kind, spaceHeight: 24 };
    case "badge":
      return { id, kind, text: "NOVO" };
    case "video":
      return {
        id,
        kind,
        videoProvider: "yt",
        videoUrl: "",
        width: 720,
        height: 405,
        borderRadius: 12,
      };
    case "embed":
      return { id, kind, embedHtml: "", width: 720 };
    case "carousel":
      return {
        id,
        kind,
        slides: [
          { id: `sl_${Date.now()}_1`, imageUrl: "", caption: "" },
          { id: `sl_${Date.now()}_2`, imageUrl: "", caption: "" },
          { id: `sl_${Date.now()}_3`, imageUrl: "", caption: "" },
        ],
        carouselMode: "slide",
        slidesPerView: 3,
        slidesPerViewMobile: 1,
        autoplay: true,
        intervalMs: 4000,
        showDots: true,
        showArrows: true,
        gap: 12,
        imageMode: "uniform",
        imageHeight: 240,
        imageWidth: 320,
        borderRadius: 12,
        backgroundTransparent: true,
        backgroundColor: "#ffffff",
        backgroundPadding: 0,
      };
    case "inline-element":
      // Wrapper genérico — sem element interno ainda, caller deve
      // preencher `inlineElement` via mapElementToInterludeBlock.
      return { id, kind, inlineElement: undefined };
  }
}

// ─── InterludeCarousel — renderer client component que espelha o
//     padrão do `CarouselElement` (uniform/original/custom + autoplay +
//     dots/arrows + perView responsivo). Usado dentro do switch
//     `case "carousel"` do InterludeBlockView. ────────────────────────

function InterludeCarousel({ block }: { block: InterludeBlock }) {
  const slides = block.slides ?? [];
  const mode = block.carouselMode ?? "slide";
  const intervalMs = block.intervalMs ?? 4000;
  const showDots = block.showDots ?? true;
  const showArrows = block.showArrows ?? true;
  const gap = block.gap ?? 12;
  const radius = block.borderRadius ?? 12;
  const autoplay = block.autoplay ?? true;
  const imageMode = block.imageMode ?? "uniform";
  const imageHeight = block.imageHeight ?? 240;
  const imageWidth = block.imageWidth ?? 320;
  const perViewDesktop = Math.max(1, Math.min(8, block.slidesPerView ?? 3));
  const perViewMobile = Math.max(
    1,
    Math.min(
      perViewDesktop,
      block.slidesPerViewMobile ?? Math.max(1, Math.floor(perViewDesktop / 2)),
    ),
  );

  const [idx, setIdx] = useState(0);
  const [perView, setPerView] = useState(perViewDesktop);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      setPerView(window.innerWidth < 640 ? perViewMobile : perViewDesktop);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [perViewDesktop, perViewMobile]);

  const maxIdx = Math.max(0, slides.length - perView);
  useEffect(() => {
    if (mode !== "slide" || !autoplay || slides.length <= perView) return;
    const handle = setInterval(() => {
      setIdx((prev) => (prev >= maxIdx ? 0 : prev + 1));
    }, Math.max(1000, intervalMs));
    return () => clearInterval(handle);
  }, [mode, autoplay, intervalMs, slides.length, perView, maxIdx]);

  // Wrapper externo respeita backgroundTransparent + padding. Quando
  // transparente, não aplica cor de fundo — útil pra sobreposição
  // sobre seções com gradiente/imagem.
  const isTransparent = block.backgroundTransparent ?? true;
  const wrapperBg = isTransparent
    ? "transparent"
    : (block.backgroundColor ?? "#ffffff");
  const wrapperPadding = block.backgroundPadding ?? 0;
  const wrapperStyle: React.CSSProperties = {
    background: wrapperBg,
    padding: wrapperPadding,
    borderRadius: wrapperPadding > 0 ? Math.max(radius, 8) : undefined,
    width: "100%",
  };

  if (slides.length === 0) {
    return (
      <div className="w-full max-w-2xl rounded border-2 border-dashed p-6 text-center text-xs text-muted-foreground">
        Adicione slides ao carrossel no editor
      </div>
    );
  }

  // ── MODO STATIC: grid responsivo com N colunas ──
  if (mode === "static") {
    return (
      <div style={wrapperStyle}>
        <div
          className="w-full grid"
          style={{
            gap,
            gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))`,
          }}
        >
          {slides.map((slide) => (
            <InterludeCarouselImage
              key={slide.id}
              slide={slide}
              radius={radius}
              imageMode={imageMode}
              imageHeight={imageHeight}
              imageWidth={imageWidth}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── MODO SLIDE: N por vez com transform animado ──
  const safeIdx = Math.min(idx, maxIdx);
  const slideBasisPct = 100 / perView;
  const translatePct = safeIdx * slideBasisPct;
  const totalDots = Math.max(1, slides.length - perView + 1);

  return (
    <div style={wrapperStyle}>
      <div
        className="relative w-full overflow-hidden"
        style={{ borderRadius: radius }}
      >
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${translatePct}%)`, gap }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="flex-shrink-0"
              style={{
                flexBasis: `calc(${slideBasisPct}% - ${(gap * (perView - 1)) / perView}px)`,
              }}
            >
              <InterludeCarouselImage
                slide={slide}
                radius={radius}
                imageMode={imageMode}
                imageHeight={imageHeight}
                imageWidth={imageWidth}
              />
            </div>
          ))}
        </div>

        {showArrows && slides.length > perView && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setIdx((p) => Math.max(0, p - 1))}
              disabled={safeIdx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white flex items-center justify-center backdrop-blur transition-colors"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={() => setIdx((p) => Math.min(maxIdx, p + 1))}
              disabled={safeIdx >= maxIdx}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white flex items-center justify-center backdrop-blur transition-colors"
            >
              ›
            </button>
          </>
        )}

        {showDots && slides.length > perView && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {Array.from({ length: totalDots }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`size-2 rounded-full transition-all ${
                  i === safeIdx ? "w-6 bg-white" : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Imagem individual do interlude carousel — espelha o `CarouselImage`
 *  do elemento principal pra que os 3 modos (uniform/original/custom)
 *  funcionem idênticos. */
function InterludeCarouselImage({
  slide,
  radius,
  imageMode,
  imageHeight,
  imageWidth,
}: {
  slide: InterludeCarouselSlide;
  radius: number;
  imageMode: "uniform" | "original" | "custom";
  imageHeight: number;
  imageWidth: number;
}) {
  const wrapperStyle: React.CSSProperties = { borderRadius: radius };
  let imgClassName = "w-full h-full object-cover";

  if (imageMode === "uniform") {
    wrapperStyle.height = imageHeight;
  } else if (imageMode === "original") {
    wrapperStyle.height = "auto";
    imgClassName = "w-full h-auto block";
  } else {
    wrapperStyle.width = imageWidth;
    wrapperStyle.height = imageHeight;
    wrapperStyle.maxWidth = "100%";
  }

  if (
    slide.aspectRatio &&
    slide.aspectRatio !== "free" &&
    imageMode !== "original"
  ) {
    const [w, h] = slide.aspectRatio.split(":").map((n) => Number(n) || 1);
    wrapperStyle.aspectRatio = `${w} / ${h}`;
    delete wrapperStyle.height;
  }

  const content = (
    <div
      className="w-full relative overflow-hidden bg-muted/20"
      style={wrapperStyle}
    >
      {slide.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.imageUrl}
          alt={slide.alt ?? slide.caption ?? ""}
          className={imgClassName}
        />
      ) : (
        <div className="w-full h-full bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">
          Sem imagem
        </div>
      )}
      {slide.caption && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white text-xs sm:text-sm">
          {slide.caption}
        </div>
      )}
    </div>
  );

  if (slide.link) {
    return (
      <a
        href={slide.link}
        target={slide.link.startsWith("#") ? undefined : "_blank"}
        rel={slide.link.startsWith("#") ? undefined : "noreferrer"}
        className="block"
      >
        {content}
      </a>
    );
  }
  return content;
}
