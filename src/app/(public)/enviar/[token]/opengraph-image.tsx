import { ImageResponse } from "next/og";
import { formatUploadLinkDeadline, getNboxUploadLinkSummary } from "@/features/nbox/server/upload-links";

// Imagem da prévia do link de envio no WhatsApp (spec 0149). Cores fixas: a imagem não segue o tema do app.

export const runtime = "nodejs";
export const alt = "Envio de arquivos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PREVIEW_COLORS = {
  background: "#161616",
  card: "#1f1f1f",
  border: "#333333",
  text: "#ffffff",
  muted: "#a3a3a3",
};

const truncate = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

export default async function UploadLinkOgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const summary = await getNboxUploadLinkSummary(token);
  const companyName = summary?.companyName ?? "Envio de arquivos";
  const companyInitial = companyName.trim().charAt(0).toUpperCase() || "?";
  const isOpen = !!summary?.isOpen && !!summary.uploadExpiresAt;
  const statusLine = !summary
    ? "Link não encontrado"
    : isOpen && summary.uploadExpiresAt
      ? `Envie até ${formatUploadLinkDeadline(summary.uploadExpiresAt)} · sem criar conta`
      : "Este link foi encerrado";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PREVIEW_COLORS.background,
          color: PREVIEW_COLORS.text,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 1040,
            height: 470,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 56,
            borderRadius: 40,
            border: `2px solid ${PREVIEW_COLORS.border}`,
            background: PREVIEW_COLORS.card,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                width: 88,
                height: 88,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 44,
                background: PREVIEW_COLORS.text,
                color: PREVIEW_COLORS.background,
                fontSize: 48,
                fontWeight: 800,
              }}
            >
              {companyInitial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{truncate(companyName, 40)}</div>
              <div style={{ fontSize: 28, color: PREVIEW_COLORS.muted }}>pediu arquivos para você</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 30, color: PREVIEW_COLORS.muted }}>Pasta</div>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, display: "flex" }}>
              {truncate(summary?.folderName ?? "—", 48)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 30,
              color: PREVIEW_COLORS.muted,
            }}
          >
            <div style={{ display: "flex" }}>{statusLine}</div>
            {isOpen && (
              <div
                style={{
                  display: "flex",
                  padding: "14px 32px",
                  borderRadius: 999,
                  background: PREVIEW_COLORS.text,
                  color: PREVIEW_COLORS.background,
                  fontWeight: 700,
                }}
              >
                Enviar arquivos
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
