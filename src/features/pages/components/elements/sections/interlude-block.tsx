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
import {
  type TextStyle,
  textStyleToCSS,
  resolveTextStyle,
} from "../../../lib/text-style";

export type InterludeBlockKind =
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
  // carousel
  slides?: InterludeCarouselSlide[];
  slidesPerView?: number;
  autoplay?: boolean;
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
    case "carousel": {
      const slides = block.slides ?? [];
      if (slides.length === 0) {
        return (
          <div className="w-full max-w-2xl rounded border-2 border-dashed p-6 text-center text-xs text-muted-foreground">
            Adicione slides ao carrossel no editor
          </div>
        );
      }
      const per = block.slidesPerView ?? 3;
      return (
        <div
          className="w-full overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: "thin" }}
        >
          <div
            className="flex gap-3 pb-2"
            style={{
              width: `${(100 * slides.length) / per}%`,
            }}
          >
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="snap-center shrink-0"
                style={{ width: `${100 / slides.length}%` }}
              >
                {slide.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.imageUrl}
                    alt={slide.caption ?? ""}
                    style={{
                      width: "100%",
                      height: block.height ?? 240,
                      objectFit: "cover",
                      borderRadius: block.borderRadius ?? 12,
                    }}
                  />
                )}
                {slide.caption && (
                  <p className="text-xs mt-2 opacity-80">{slide.caption}</p>
                )}
              </div>
            ))}
          </div>
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
        slidesPerView: 3,
        height: 240,
        borderRadius: 12,
      };
  }
}
