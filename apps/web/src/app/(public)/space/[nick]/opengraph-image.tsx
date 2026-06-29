import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Spacehome NASA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ nick: string }>;
}

/**
 * OG image gerada on-demand para /space/[nick]. Só renderiza
 * dados se a Spacehome for pública — caso contrário, devolve
 * um card genérico (não vaza nome/bio).
 */
export default async function SpaceOgImage({ params }: Props) {
  const { nick } = await params;
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: {
        select: {
          name: true,
          bio: true,
          logo: true,
          bannerUrl: true,
          isSpacehomePublic: true,
        },
      },
    },
  });

  const isPrivate =
    !station ||
    station.type !== "ORG" ||
    !station.org ||
    !station.org.isSpacehomePublic;

  const name = isPrivate ? "Spacehome · N.A.S.A" : station!.org!.name;
  const bio = isPrivate
    ? "Uma empresa no universo NASA"
    : station!.org!.bio ?? "Descubra esta empresa no N.A.S.A Agents";
  const logo =
    !isPrivate && station?.org?.logo ? station.org.logo : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #7c2d12 100%)",
          color: "#fff",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#fdba74",
          }}
        >
          <span style={{ fontWeight: 700 }}>N.A.S.A</span>
          <span style={{ opacity: 0.6 }}>/ Spacehome</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 24,
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: "2px solid rgba(253,186,116,0.3)",
            }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                width={140}
                height={140}
                style={{ objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 64, fontWeight: 800 }}>
                {name[0]?.toUpperCase() ?? "N"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>
              {name}
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.7)",
                maxWidth: 720,
              }}
            >
              {bio.length > 120 ? bio.slice(0, 117) + "..." : bio}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.5)",
            borderTop: "1px solid rgba(255,255,255,0.2)",
            paddingTop: 24,
          }}
        >
          nasaex.com · @{nick}
        </div>
      </div>
    ),
    size,
  );
}
