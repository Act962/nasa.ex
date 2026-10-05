import { AbsoluteFill } from "remotion";
import { brandColors, useBrandFonts, type Brand } from "../brand";
import { BrandBackground, BrandLogo } from "../components/BrandScene";
import { AnimatedHeadline } from "../components/AnimatedText";

export type FeedPostProps = { brand: Brand; headline: string; body?: string; cta?: string; mediaUrl?: string | null };

/** Post de feed 4:5 (imagem única). */
export function FeedPost({ brand, headline, body, cta, mediaUrl }: FeedPostProps) {
  const fonts = useBrandFonts(brand);
  const colors = brandColors(brand);
  return (
    <BrandBackground brand={brand} mediaUrl={mediaUrl}>
      <AbsoluteFill style={{ padding: 90, justifyContent: "space-between" }}>
        <BrandLogo brand={brand} size={70} fontFamily={fonts.heading} />
        <div>
          <AnimatedHeadline text={headline} fontFamily={fonts.heading} fontSize={96} color={colors.text} accent={colors.accent} />
          {body ? <p style={{ fontFamily: fonts.body, fontSize: 40, lineHeight: 1.4, color: colors.muted, marginTop: 28 }}>{body}</p> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {cta ? <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 38, background: colors.accent, color: "#FFFFFF", borderRadius: 999, padding: "18px 40px" }}>{cta}</div> : <span />}
          <div style={{ fontFamily: fonts.body, fontSize: 30, color: colors.muted }}>{brand.handle ?? ""}</div>
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
}
