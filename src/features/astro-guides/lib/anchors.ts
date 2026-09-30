// Catálogo de âncoras que os guias do Astro podem destacar (spec 0046).
// O componente usa `data-guide={GUIDE_ANCHORS.x.id}`; `pnpm guides:check`
// confere que cada âncora usada por um guia ainda existe no código.

export const GUIDE_ANCHORS = {
  commentsConnectInstagram: {
    id: "comments.connect-instagram",
    description: "Botão \"Conectar Instagram passo a passo\" em /comments → Integrações",
  },
  trackingList: {
    id: "tracking.list",
    description: "Lista de trackings da organização em /tracking",
  },
  trackingNewButton: {
    id: "tracking.new-button",
    description: "Botão \"Novo tracking\" em /tracking",
  },
  trackingCreateName: {
    id: "tracking.create.name",
    description: "Campo de nome no modal de criar tracking",
  },
  trackingCreateSubmit: {
    id: "tracking.create.submit",
    description: "Botão \"Criar\" no modal de criar tracking",
  },
  boardColumns: {
    id: "tracking.board.columns",
    description: "Área das colunas (etapas) do board do tracking",
  },
  boardNewLeadButton: {
    id: "tracking.board.new-lead",
    description: "Botão \"Novo Lead\" na barra do board",
  },
  boardCustomizeButton: {
    id: "tracking.board.customize",
    description: "Botão \"Personalizar\" na barra do board",
  },
  boardCustomizeSheet: {
    id: "tracking.board.customize-sheet",
    description: "Sheet \"Personalizar board\" com os toggles de campos",
  },
  leadSheetName: {
    id: "lead-sheet.name",
    description: "Campo de nome no Sheet de novo lead",
  },
  leadSheetPhone: {
    id: "lead-sheet.phone",
    description: "Campo de WhatsApp no Sheet de novo lead",
  },
  leadSheetSubmit: {
    id: "lead-sheet.submit",
    description: "Botão \"Criar lead\" no Sheet de novo lead",
  },
} as const;

export type GuideAnchorKey = keyof typeof GUIDE_ANCHORS;

export function guideSelector(anchorKey: GuideAnchorKey): string {
  return `[data-guide="${GUIDE_ANCHORS[anchorKey].id}"]`;
}
