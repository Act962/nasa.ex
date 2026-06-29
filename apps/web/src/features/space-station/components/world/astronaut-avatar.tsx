"use client";

/**
 * AstronautAvatar
 *
 * Renders the NASA astronaut SVG with:
 *  - Profile photo inside the visor (circular, exact position)
 *  - Suit color tint via CSS overlay
 *  - Hair / beard / face accessory emoji overlays (when no profile photo)
 *  - Helmet displayed in hand (face always visible)
 *
 * Face circle in the 576×576 SVG:
 *   center  → (291.75, 134.375)  = (50.65%, 23.33%)
 *   radius  → 111.25             = 19.31%
 */

import { useMemo } from "react";
import type { AvatarConfig } from "../../types";

interface Props {
  avatar: AvatarConfig;
  userImage?: string | null;
  /** Display size in px (square). Default 160 */
  size?: number;
  className?: string;
}

// Convert hex color to an HSL hue-rotate value to tint the SVG.
// We derive the delta from the default suit hue (purple ~270°).
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Default suit hue in the SVG (the orange/tan astronaut suit) ~30° */
const DEFAULT_SUIT_HUE = 30;

function suitFilter(suitColor: string): string {
  try {
    const { h, s } = hexToHsl(suitColor);
    const rotate = h - DEFAULT_SUIT_HUE;
    const saturate = Math.max(0.3, s / 50);
    return `hue-rotate(${rotate}deg) saturate(${saturate})`;
  } catch {
    return "none";
  }
}

const FACE_CX_PCT  = 50.65;
const FACE_CY_PCT  = 23.33;
const FACE_R_PCT   = 19.31;

export function AstronautAvatar({ avatar, userImage, size = 160, className = "" }: Props) {
  const showPhoto = avatar.useProfilePhoto && userImage;

  // Position of the face circle in pixels
  const faceCX   = (FACE_CX_PCT / 100) * size;
  const faceCY   = (FACE_CY_PCT / 100) * size;
  const faceR    = (FACE_R_PCT  / 100) * size;
  const faceDiam = faceR * 2;

  const faceAccessoryEmoji = useMemo(() => {
    if (avatar.faceAccessory === "glasses")    return "🤓";
    if (avatar.faceAccessory === "sunglasses") return "😎";
    return null;
  }, [avatar.faceAccessory]);

  const hairEmoji = useMemo(() => {
    if (showPhoto) return null; // photo replaces hair rendering
    const map: Record<string, string> = {
      short: "👱", long: "👩", curly: "🌀", afro: "✊", ponytail: "🎀",
    };
    return map[avatar.hairStyle] ?? null;
  }, [avatar.hairStyle, showPhoto]);

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* ── Astronaut body SVG ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/astronauta.svg"
        alt="astronauta"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          display: "block",
          filter: suitFilter(avatar.suitColor),
          // preserve crisp edges for pixel art contexts
          imageRendering: "auto",
        }}
        draggable={false}
      />

      {/* ── Suit color overlay (blend mode) ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: avatar.suitColor,
          mixBlendMode: "color",
          opacity: 0.35,
          borderRadius: "inherit",
          // Mask the face area so the color doesn't bleed onto the photo
          maskImage: `radial-gradient(circle ${faceR + 4}px at ${faceCX}px ${faceCY}px, transparent 100%, black 100%)`,
          WebkitMaskImage: `radial-gradient(circle ${faceR + 4}px at ${faceCX}px ${faceCY}px, transparent 100%, black 100%)`,
        }}
      />

      {/* ── Face / visor content ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left:   faceCX - faceR,
          top:    faceCY - faceR,
          width:  faceDiam,
          height: faceDiam,
          borderRadius: "50%",
          overflow: "hidden",
          background: avatar.skinTone,
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={userImage!}
            alt="perfil"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          /* Fallback: skin tone + hair/beard emoji */
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 1,
              background: avatar.skinTone,
            }}
          >
            {hairEmoji && (
              <span style={{ fontSize: faceR * 0.7, lineHeight: 1 }}>{hairEmoji}</span>
            )}
            {avatar.beardStyle !== "none" && (
              <span style={{ fontSize: faceR * 0.5, lineHeight: 1 }}>🧔</span>
            )}
          </div>
        )}
      </div>

      {/* ── Face accessory (glasses etc.) ── */}
      {faceAccessoryEmoji && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left:   faceCX - faceR * 0.75,
            top:    faceCY - faceR * 0.25,
            width:  faceR * 1.5,
            textAlign: "center",
            fontSize: faceR * 0.65,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          {faceAccessoryEmoji}
        </div>
      )}

      {/* ── Helmet in hand (bottom-left) ── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: size * 0.05,
          left:   size * 0.05,
          fontSize: size * 0.13,
          lineHeight: 1,
          filter: `hue-rotate(${(() => { try { return hexToHsl(avatar.helmetColor).h - 200; } catch { return 0; } })()}deg)`,
        }}
        title="Capacete na mão"
      >
        ⛑️
      </div>
    </div>
  );
}
