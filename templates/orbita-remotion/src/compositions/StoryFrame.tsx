import { AbsoluteFill } from "remotion";
import { brandColors, useBrandFonts, type Brand } from "../brand";
import { BrandBackground, BrandLogo } from "../components/BrandScene";
import { AnimatedHeadline, FadeIn } from "../components/AnimatedText";

export type StoryFrameProps = { brand: Brand; headline: string; body?: string; cta?: string; mediaUrl?: string | null; durationSec?: number };

/** Story 9:16. O texto vai na arte (Story não mostra legenda). Deixe o rodapé livre para o link do Instagram. */
export function StoryFrame({ brand, headline, body, cta, mediaUrl }: StoryFrameProps) {
  const fonts = useBrandFonts(brand);
  const colors = brandColors(brand);
  return (
    <BrandBackground brand={brand} mediaUrl={mediaUrl}>
      <AbsoluteFill style={{ padding: "150px 90px 420px", justifyContent: "space-between" }}>
        <BrandLogo brand={brand} size={80} fontFamily={fonts.heading} />
        <div>
          <AnimatedHeadline text={headline} fontFamily={fonts.heading} fontSize={110} color={colors.text} accent={colors.accent} />
          {body ? (
            <FadeIn delayFrames={14}>
              <p style={{ fontFamily: fonts.body, fontSize: 48, lineHeight: 1.35, color: colors.muted, marginTop: 36 }}>{body}</p>
            </FadeIn>
          ) : null}
          {cta ? (
            <FadeIn delayFrames={22}>
              <div style={{ display: "inline-block", marginTop: 56, fontFamily: fonts.heading, fontWeight: 700, fontSize: 52, background: colors.accent, color: "#FFFFFF", borderRadius: 999, padding: "22px 48px" }}>{cta}</div>
            </FadeIn>
          ) : null}
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
}
