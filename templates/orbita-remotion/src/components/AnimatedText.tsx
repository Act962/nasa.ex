import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** Título que entra palavra por palavra (estático quando renderizado como still). */
export function AnimatedHeadline({ text, fontFamily, fontSize, color, accent, delayFrames = 0 }: { text: string; fontFamily: string; fontSize: number; color: string; accent: string; delayFrames?: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isStill = durationInFrames <= 1;
  const words = text
    .split(/(\*[^*]+\*)/)
    .flatMap((segment) => {
      const isHighlight = segment.startsWith("*") && segment.endsWith("*") && segment.length > 2;
      const content = isHighlight ? segment.slice(1, -1) : segment;
      return content.split(/\s+/).filter(Boolean).map((word) => ({ word, isHighlight }));
    });
  return (
    <div style={{ fontFamily, fontSize, fontWeight: 800, lineHeight: 1.08, color, letterSpacing: "-0.02em" }}>
      {words.map(({ word, isHighlight }, index) => {
        const progress = isStill ? 1 : spring({ frame: frame - delayFrames - index * 3, fps, config: { damping: 200 } });
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              marginRight: /^[?!.,:;…]/.test(words[index + 1]?.word ?? "") ? 0 : "0.25em",
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px)`,
              color: isHighlight ? accent : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function FadeIn({ children, delayFrames = 0 }: { children: React.ReactNode; delayFrames?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = durationInFrames <= 1 ? 1 : interpolate(frame - delayFrames, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ opacity, transform: `translateY(${(1 - opacity) * 20}px)` }}>{children}</div>;
}
