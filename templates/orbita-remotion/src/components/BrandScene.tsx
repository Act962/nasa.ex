import type { ReactNode } from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { brandColors, type Brand } from "../brand";

const VIDEO_EXTENSION = /\.(mp4|mov|webm|m4v)(\?|$)/i;

/** Fundo da marca: cor escura da paleta, brilho na cor de destaque e mídia opcional por baixo. */
export function BrandBackground({ brand, mediaUrl, children }: { brand: Brand; mediaUrl?: string | null; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const colors = brandColors(brand);
  const drift = interpolate(frame, [0, 300], [0, 60], { extrapolateRight: "extend" });
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, color: colors.text, overflow: "hidden" }}>
      {mediaUrl ? (
        <AbsoluteFill>
          {VIDEO_EXTENSION.test(mediaUrl) ? (
            <OffthreadVideo src={mediaUrl} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.background}33 0%, ${colors.background}cc 60%, ${colors.background} 100%)` }} />
        </AbsoluteFill>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              width: width * 1.2,
              height: width * 1.2,
              left: -width * 0.35 + drift,
              top: height * 0.55 - drift,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colors.accent}55 0%, ${colors.accent}00 65%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: width * 0.9,
              height: width * 0.9,
              right: -width * 0.3 - drift / 2,
              top: -width * 0.25,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${colors.accent}33 0%, ${colors.accent}00 70%)`,
            }}
          />
        </>
      )}
      {children}
    </AbsoluteFill>
  );
}

export function BrandLogo({ brand, size, fontFamily }: { brand: Brand; size: number; fontFamily: string }) {
  if (brand.logoUrl) {
    return (
      <div style={{ display: "flex" }}>
        <Img src={brand.logoUrl} style={{ height: size, width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  return <div style={{ fontFamily, fontWeight: 800, fontSize: size * 0.7, letterSpacing: "0.12em" }}>{brand.brandName.toUpperCase()}</div>;
}
