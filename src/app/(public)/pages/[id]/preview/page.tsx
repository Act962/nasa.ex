import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { PublicPageRenderer } from "@/features/pages/components/public/public-page-renderer";
import { FIXED_TOP_OFFSET_VARIABLE } from "@/features/pages/lib/fixed-top-offset";
import type { PageLayout } from "@/features/pages/types";
import Link from "next/link";
import { ArrowLeft, Eye, Lightbulb, Pencil, MousePointerClick } from "lucide-react";

const PREVIEW_BAR_HEIGHT_PX = 60;

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

/** Tira os pixels de anúncio/analytics: a miniatura da lista não pode contar como visita. */
function withoutTrackingScripts(layout: PageLayout): PageLayout {
  const layoutWithMeta = layout as PageLayout & { meta?: Record<string, unknown> };
  if (!layoutWithMeta.meta) return layout;
  return {
    ...layoutWithMeta,
    meta: { ...layoutWithMeta.meta, metaPixelId: undefined, googleTagId: undefined, gtmId: undefined },
  } as unknown as PageLayout;
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  // ?preview=1: miniatura da lista de sites — só a página, sem barra e sem pixels.
  const isThumbnail = (await searchParams).preview === "1";

  const page = await prisma.nasaPage.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      layout: true,
      palette: true,
      fontFamily: true,
      // Slug da org pro ChatButton (server-side resolved)
      organization: { select: { slug: true } },
    },
  });

  if (!page || !page.layout) notFound();

  if (isThumbnail) {
    return (
      <PublicPageRenderer
        layout={withoutTrackingScripts(page.layout as unknown as PageLayout)}
        palette={(page.palette as Record<string, string>) ?? {}}
        fontFamily={page.fontFamily}
        organizationSlug={page.organization?.slug ?? undefined}
      />
    );
  }

  return (
    <>
      {/* Barra flutuante de preview — refeita pra deixar CLARO que
          esta é só a visualização, e que pra editar elementos
          (textos, imagens, botões) o user precisa ir pro builder. */}
      <div
        className="dark fixed inset-x-0 top-0 z-[10000] flex items-center gap-3 bg-background/95 px-4 text-foreground backdrop-blur-md"
        style={{ height: PREVIEW_BAR_HEIGHT_PX }}
      >
        <Link
          href={`/pages/${id}`}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <Eye size={13} />
          <span className="truncate font-medium text-foreground">{page.title}</span>
          <span className="shrink-0 rounded border border-info/30 bg-info/15 px-[7px] py-px text-[10px] font-semibold tracking-wider text-info uppercase">
            Prévia
          </span>
        </div>

        {/* Hint + CTA principal pra ir editar.
            Esse é o ponto de fricção do user — ele não sabia que
            os blocos eram editáveis no builder. */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <MousePointerClick size={13} className="text-info" />
          <span className="hidden items-center gap-1 min-[720px]:inline-flex">
            Aqui é só prévia. Pra editar textos, imagens, botões →
          </span>
        </div>

        <Link
          href={`/pages/${id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground no-underline shadow-md hover:bg-primary/90"
        >
          <Pencil size={14} />
          <span className="hidden min-[720px]:inline">Editar elementos</span>
          <span className="min-[720px]:hidden">Editar</span>
        </Link>
      </div>

      <div aria-hidden style={{ height: PREVIEW_BAR_HEIGHT_PX }} />

      {/* O menu fixo do site desce a altura da barra; sem isso ele fica por cima dela. */}
      <div style={{ [FIXED_TOP_OFFSET_VARIABLE]: `${PREVIEW_BAR_HEIGHT_PX}px` } as CSSProperties}>
        <PublicPageRenderer
          layout={page.layout as unknown as PageLayout}
          palette={(page.palette as Record<string, string>) ?? {}}
          fontFamily={page.fontFamily}
          organizationSlug={page.organization?.slug ?? undefined}
        />
      </div>
      {/* Fica no fim: no topo, o menu fixo do site ocuparia a mesma faixa e cobriria o aviso. */}
      <div className="bg-info/10 px-4 py-3 text-center text-xs leading-normal text-muted-foreground">
        <Lightbulb size={13} className="mr-1 inline align-[-2px] text-info" />
        <strong>Esta é a prévia da landing</strong> — readonly por
        design (mesma renderização da página publicada). Pra mexer em
        textos, imagens, botões, cores, fontes e adicionar/remover
        blocos:{" "}
        <Link href={`/pages/${id}`} className="font-semibold text-info underline">
          abra o builder
        </Link>
        . Lá cada bloco é clicável e o painel direito mostra todos
        os campos editáveis.
      </div>
    </>
  );
}
