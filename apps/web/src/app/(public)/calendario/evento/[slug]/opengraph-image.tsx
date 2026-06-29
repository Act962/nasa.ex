import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

export const runtime = "nodejs";
export const alt = "Evento NASA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { slug: string } }) {
  const event = await prisma.action.findFirst({
    where: { publicSlug: params.slug, isPublic: true },
    select: {
      title: true,
      coverImage: true,
      startDate: true,
      city: true,
      state: true,
      eventCategory: true,
    },
  });

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
            color: "white",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          Evento NASA 🚀
        </div>
      ),
      { ...size },
    );
  }

  const when = event.startDate
    ? dayjs(event.startDate).format("DD [de] MMM · HH:mm")
    : "";
  const where =
    [event.city, event.state].filter(Boolean).join(" / ") || "online";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const coverUrl = event.coverImage
    ? event.coverImage.startsWith("http")
      ? event.coverImage
      : `${appUrl}${event.coverImage}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(135deg, #0f0a19 0%, #2e1065 50%, #831843 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
              filter: "blur(4px)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(124, 58, 237, 0.85) 0%, rgba(236, 72, 153, 0.85) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 24,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              opacity: 0.9,
            }}
          >
            🚀 NASA · Calendário Público
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.05,
                maxWidth: "90%",
              }}
            >
              {event.title}
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 28, opacity: 0.95 }}>
              {when && <span>📅 {when}</span>}
              <span>📍 {where}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
