import { AbsoluteFill, Sequence, type CalculateMetadataFunction } from "remotion";
import { brandColors, useBrandFonts, type Brand } from "../brand";
import { BrandBackground, BrandLogo } from "../components/BrandScene";
import { AnimatedHeadline, FadeIn } from "../components/AnimatedText";

export type ReelScene = { headline: string; body?: string; durationSec?: number; mediaUrl?: string | null };
export type PostReelProps = { brand: Brand; scenes: ReelScene[]; cta?: string; hashtags?: string[] };

export const REEL_FPS = 30;
const DEFAULT_SCENE_SEC = 3;
const END_CARD_SEC = 3;

const sceneFrames = (scene: ReelScene) => Math.round((scene.durationSec ?? DEFAULT_SCENE_SEC) * REEL_FPS);

export const calculateReelMetadata: CalculateMetadataFunction<PostReelProps> = ({ props }) => ({
  durationInFrames: props.scenes.reduce((total, scene) => total + sceneFrames(scene), 0) + END_CARD_SEC * REEL_FPS,
});

function SceneCard({ brand, scene, fonts }: { brand: Brand; scene: ReelScene; fonts: { heading: string; body: string } }) {
  const colors = brandColors(brand);
  return (
    <BrandBackground brand={brand} mediaUrl={scene.mediaUrl}>
      <AbsoluteFill style={{ padding: 90 }}>
        <BrandLogo brand={brand} size={70} fontFamily={fonts.heading} />
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: "180px 90px 260px", justifyContent: "center" }}>
        <AnimatedHeadline text={scene.headline} fontFamily={fonts.heading} fontSize={104} color={colors.text} accent={colors.accent} />
        {scene.body ? (
          <FadeIn delayFrames={14}>
            <p style={{ fontFamily: fonts.body, fontSize: 46, lineHeight: 1.35, color: colors.muted, marginTop: 40 }}>{scene.body}</p>
          </FadeIn>
        ) : null}
      </AbsoluteFill>
    </BrandBackground>
  );
}

function EndCard({ brand, cta, hashtags, fonts }: { brand: Brand; cta?: string; hashtags?: string[]; fonts: { heading: string; body: string } }) {
  const colors = brandColors(brand);
  return (
    <BrandBackground brand={brand}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56, padding: 90, textAlign: "center" }}>
        <FadeIn>
          <BrandLogo brand={brand} size={150} fontFamily={fonts.heading} />
        </FadeIn>
        {cta ? (
          <FadeIn delayFrames={8}>
            <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 60, background: colors.accent, color: "#FFFFFF", borderRadius: 999, padding: "26px 56px" }}>{cta}</div>
          </FadeIn>
        ) : null}
        <FadeIn delayFrames={14}>
          <div style={{ fontFamily: fonts.body, fontSize: 40, color: colors.muted }}>
            {[brand.handle, ...(hashtags ?? [])].filter(Boolean).join("  ")}
          </div>
        </FadeIn>
      </AbsoluteFill>
    </BrandBackground>
  );
}

export function PostReel({ brand, scenes, cta, hashtags }: PostReelProps) {
  const fonts = useBrandFonts(brand);
  let cursor = 0;
  return (
    <AbsoluteFill>
      {scenes.map((scene, index) => {
        const from = cursor;
        cursor += sceneFrames(scene);
        return (
          <Sequence key={index} from={from} durationInFrames={sceneFrames(scene)}>
            <SceneCard brand={brand} scene={scene} fonts={fonts} />
          </Sequence>
        );
      })}
      <Sequence from={cursor}>
        <EndCard brand={brand} cta={cta} hashtags={hashtags} fonts={fonts} />
      </Sequence>
    </AbsoluteFill>
  );
}
