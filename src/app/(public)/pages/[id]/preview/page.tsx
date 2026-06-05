import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicPageRenderer } from "@/features/pages/components/public/public-page-renderer";
import type { PageLayout } from "@/features/pages/types";
import Link from "next/link";
import { ArrowLeft, Eye, Pencil, MousePointerClick } from "lucide-react";

interface Params {
  id: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = await prisma.nasaPage.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: page ? `Prévia — ${page.title}` : "Prévia" };
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const page = await prisma.nasaPage.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      layout: true,
      palette: true,
      fontFamily: true,
    },
  });

  if (!page || !page.layout) notFound();

  return (
    <>
      {/* Barra flutuante de preview — refeita pra deixar CLARO que
          esta é só a visualização, e que pra editar elementos
          (textos, imagens, botões) o user precisa ir pro builder. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 16px",
          background: "rgba(15, 23, 42, 0.96)",
          backdropFilter: "blur(10px)",
          borderBottom: "2px solid rgba(139,92,246,0.4)",
        }}
      >
        <Link
          href={`/pages/${id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#94a3b8",
            textDecoration: "none",
            padding: "6px 10px",
            borderRadius: "6px",
          }}
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#64748b",
            flex: 1,
            minWidth: 0,
          }}
        >
          <Eye size={13} />
          <span
            style={{
              color: "#e2e8f0",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {page.title}
          </span>
          <span
            style={{
              background: "rgba(139,92,246,0.2)",
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: "4px",
              padding: "1px 7px",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Prévia
          </span>
        </div>

        {/* Hint + CTA principal pra ir editar.
            Esse é o ponto de fricção do user — ele não sabia que
            os blocos eram editáveis no builder. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: "#cbd5e1",
          }}
        >
          <MousePointerClick size={13} style={{ color: "#a78bfa" }} />
          <span
            style={{
              display: "none",
              alignItems: "center",
              gap: "4px",
            }}
            className="preview-hint-text"
          >
            Aqui é só prévia. Pra editar textos, imagens, botões →
          </span>
        </div>

        <Link
          href={`/pages/${id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            textDecoration: "none",
            padding: "8px 16px",
            borderRadius: "8px",
            background:
              "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            boxShadow: "0 4px 12px rgba(139,92,246,0.4)",
          }}
        >
          <Pencil size={14} />
          <span className="preview-cta-label">Editar elementos</span>
          <span className="preview-cta-label-short">Editar</span>
        </Link>
      </div>

      {/* CSS pra mostrar o hint texto só em telas >= 720px e
          encurtar o CTA em mobile pra não estourar a topbar. */}
      <style>{`
        .preview-cta-label { display: none; }
        .preview-cta-label-short { display: inline; }
        @media (min-width: 720px) {
          .preview-hint-text { display: inline-flex !important; }
          .preview-cta-label { display: inline; }
          .preview-cta-label-short { display: none; }
        }
      `}</style>

      {/* Banner secundário (não-fixed) explicando que cada bloco
          é editável quando vai pro builder. Aparece UMA VEZ no topo
          da preview, abaixo da barra fixa. */}
      <div
        style={{
          padding: "12px 16px",
          background:
            "linear-gradient(90deg, rgba(139,92,246,0.10) 0%, rgba(99,102,241,0.06) 100%)",
          borderBottom: "1px solid rgba(139,92,246,0.20)",
          textAlign: "center",
          fontSize: "12px",
          color: "#475569",
          lineHeight: 1.5,
        }}
      >
        💡 <strong>Esta é a prévia da landing</strong> — readonly por
        design (mesma renderização da página publicada). Pra mexer em
        textos, imagens, botões, cores, fontes e adicionar/remover
        blocos:{" "}
        <Link
          href={`/pages/${id}`}
          style={{
            color: "#7c3aed",
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          abra o builder
        </Link>
        . Lá cada bloco é clicável e o painel direito mostra todos
        os campos editáveis.
      </div>

      {/* Espaço para a barra não cobrir conteúdo */}
      <div style={{ paddingTop: "0" }}>
        <PublicPageRenderer
          layout={page.layout as unknown as PageLayout}
          palette={(page.palette as Record<string, string>) ?? {}}
          fontFamily={page.fontFamily}
        />
      </div>
    </>
  );
}
