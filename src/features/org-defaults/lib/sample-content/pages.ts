import "server-only";
import prisma from "@/lib/prisma";
import { sampleName, shortRandomSuffix, toUrlSlug } from "./helpers";
import type { SampleSeedContext } from "./types";

const PALETTE = { primary: "#6366f1", accent: "#f59e0b", bg: "#ffffff", fg: "#0f172a", muted: "#94a3b8" };

function textDocument(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function buildSampleLayout() {
  return {
    mode: "single",
    artboard: { width: 1440, minHeight: 900 },
    meta: {
      title: "Página de apresentação (exemplo)",
      description: "Página de exemplo criada automaticamente para você começar.",
    },
    main: {
      elements: [
        {
          id: crypto.randomUUID(),
          type: "shape",
          x: 0, y: 0, w: 1440, h: 520,
          shape: "rect",
          fill: PALETTE.primary,
          borderRadius: 0,
          zIndex: 0,
        },
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 160, y: 160, w: 1120, h: 100,
          content: textDocument("Bem-vindo à nossa loja"),
          color: "#ffffff",
          fontSize: 56,
          fontFamily: "Inter",
          align: "center",
          zIndex: 1,
        },
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 260, y: 280, w: 920, h: 80,
          content: textDocument("Produtos de qualidade, atendimento de perto e entrega rápida na sua região."),
          color: "#e0e7ff",
          fontSize: 22,
          fontFamily: "Inter",
          align: "center",
          zIndex: 1,
        },
        {
          id: crypto.randomUUID(),
          type: "button",
          x: 610, y: 390, w: 220, h: 56,
          label: "Fale com a gente",
          variant: "solid",
          radius: 10,
          bg: PALETTE.accent,
          fg: "#ffffff",
          zIndex: 1,
        },
        {
          id: crypto.randomUUID(),
          type: "text",
          x: 160, y: 600, w: 1120, h: 120,
          content: textDocument(
            "Esta é uma página de exemplo. Edite textos, cores e imagens e publique quando estiver pronta.",
          ),
          color: PALETTE.fg,
          fontSize: 20,
          fontFamily: "Inter",
          align: "center",
          zIndex: 1,
        },
      ],
    },
  };
}

export async function seedSampleNasaPage(context: SampleSeedContext): Promise<void> {
  const pageSlug = `${toUrlSlug(context.organizationSlug) || "empresa"}-exemplo-${shortRandomSuffix()}`.slice(0, 64);

  await prisma.nasaPage.create({
    data: {
      organizationId: context.organizationId,
      userId: context.ownerUserId,
      title: sampleName("Página de apresentação"),
      slug: pageSlug,
      description: "Página institucional de exemplo. Personalize e publique quando quiser.",
      intent: "INSTITUTIONAL",
      status: "DRAFT",
      layerCount: 1,
      palette: PALETTE,
      fontFamily: "Inter",
      layout: buildSampleLayout(),
      starsSpent: 0,
    },
  });
}
