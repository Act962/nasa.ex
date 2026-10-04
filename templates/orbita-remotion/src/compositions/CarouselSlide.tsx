import { AbsoluteFill } from "remotion";
import { brandColors, useBrandFonts, type Brand } from "../brand";
import { BrandBackground, BrandLogo } from "../components/BrandScene";
import { AnimatedHeadline } from "../components/AnimatedText";

export type CarouselSlideProps = { brand: Brand; index: number; total: number; headline: string; body?: string; variant?: "cover" | "content" | "cta"; mediaUrl?: string | null };

/** Card 4:5 de carrossel. Renderize um por card com `remotion still`, mudando index/headline. */
export function CarouselSlide({ brand, index, total, headline, body, variant = "content", mediaUrl }: CarouselSlideProps) {
  const fonts = useBrandFonts(brand);
  const colors = brandColors(brand);
  const isCover = variant === "cover";
  const isCta = variant === "cta";
  return (
    <BrandBackground brand={brand} mediaUrl={mediaUrl}>
      <AbsoluteFill style={{ padding: 90, justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <BrandLogo brand={brand} size={64} fontFamily={fonts.heading} />
          <div style={{ fontFamily: fonts.body, fontSize: 32, color: colors.muted }}>
            {index}/{total}
          </div>
        </div>
        <div style={{ textAlign: isCta ? "center" : "left" }}>
          {!isCover && !isCta ? <div style={{ fontFamily: fonts.heading, fontSize: 120, fontWeight: 800, color: colors.accent, lineHeight: 1 }}>{String(index - 1).padStart(2, "0")}</div> : null}
          <AnimatedHeadline text={headline} fontFamily={fonts.heading} fontSize={isCover ? 104 : 80} color={colors.text} accent={colors.accent} />
          {body ? <p style={{ fontFamily: fonts.body, fontSize: 40, lineHeight: 1.4, color: colors.muted, marginTop: 28 }}>{body}</p> : null}
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 30, color: colors.muted, textAlign: isCta ? "center" : "right" }}>
          {isCta ? brand.handle ?? brand.website ?? "" : index < total ? "arraste →" : ""}
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
}
