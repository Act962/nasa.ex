import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  FormErrorsType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { ChildCanvasComponentWrapper } from "@/features/form/components/common/utils/child-canvas-component-wrapper";
import { ChildFormComponentWrapper } from "@/features/form/components/common/utils/child-form-component-wrapper";
import { ChildPropertiesComponentWrapper } from "@/features/form/components/common/utils/child-properties-component-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { allBlockLayouts } from "@/features/form/constants";
import { getContrastColor } from "@/utils/get-contrast-color";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { cn } from "@/lib/utils";
import { FormSettings } from "@/generated/prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  Active,
  DragEndEvent,
  useDndMonitor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripHorizontal,
  GripVertical,
  Rows2,
  Trash2Icon,
  X,
} from "lucide-react";
import { useState, type CSSProperties } from "react";

type ChildWidth = "third" | "half" | "two-thirds" | "full";
const WIDTH_CYCLE: ChildWidth[] = ["full", "two-thirds", "half", "third"];

// Alinhamento horizontal dos child blocks dentro do RowLayout. Aplica
// `justify-content` no flex container — relevante quando os children não
// preenchem 100% da largura (ex: dois blocos de 33% cada).
type RowAlign =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around"
  | "evenly";

const ROW_ALIGN_OPTIONS: { value: RowAlign; label: string; hint: string }[] = [
  { value: "start", label: "Esquerda", hint: "Blocos colados à esquerda" },
  { value: "center", label: "Centro", hint: "Blocos centralizados juntos" },
  { value: "end", label: "Direita", hint: "Blocos colados à direita" },
  { value: "between", label: "Distribuídos (cantos)", hint: "Espaço só entre os blocos" },
  { value: "around", label: "Distribuídos (com bordas)", hint: "Espaço igual entre e nas bordas" },
  { value: "evenly", label: "Uniforme", hint: "Mesmo espaço entre tudo" },
];

function getRowAlign(blockInstance: FormBlockInstance): RowAlign {
  const a = (blockInstance.attributes ?? {}) as { rowAlign?: RowAlign };
  if (a.rowAlign && ROW_ALIGN_OPTIONS.some((o) => o.value === a.rowAlign)) {
    return a.rowAlign;
  }
  return "start";
}

function getRowAlignClass(align: RowAlign): string {
  switch (align) {
    case "center":
      return "justify-center";
    case "end":
      return "justify-end";
    case "between":
      return "justify-between";
    case "around":
      return "justify-around";
    case "evenly":
      return "justify-evenly";
    case "start":
    default:
      return "justify-start";
  }
}

function getChildWidth(child: FormBlockInstance): ChildWidth {
  // Lê primeiro `columnWidth` (novo) e cai em `width` antigo só se for um dos
  // valores válidos — assim coexiste com blocos que usam `width` em pixels
  // (ImageUpload, ImageDisplay).
  const cw = child.attributes?.columnWidth as ChildWidth | undefined;
  if (cw && WIDTH_CYCLE.includes(cw)) return cw;
  const w = child.attributes?.width as unknown;
  if (typeof w === "string" && WIDTH_CYCLE.includes(w as ChildWidth))
    return w as ChildWidth;
  return "full";
}

function getBasisClass(width: ChildWidth): string {
  // Respeita as posições configuradas no builder a partir de `sm` (640px):
  // mobile pequeno empilha vertical (espaço apertado), mas tablet e maior
  // mantêm o layout side-by-side configurado (third / half / two-thirds).
  // Em desktop o form ganha cap de 650px (no parent), mas as proporções
  // internas ficam idênticas ao que o admin desenhou.
  switch (width) {
    case "third":
      return "basis-full sm:basis-[calc(33.3333%-0.5rem)]";
    case "half":
      return "basis-full sm:basis-[calc(50%-0.375rem)]";
    case "two-thirds":
      return "basis-full sm:basis-[calc(66.6667%-0.25rem)]";
    case "full":
    default:
      return "basis-full";
  }
}

const WIDTH_LABEL: Record<ChildWidth, string> = {
  full: "100%",
  "two-thirds": "66%",
  half: "50%",
  third: "33%",
};

const blockCategory: FormCategoryType = "Layout";
const blockType: FormBlockType = "RowLayout";

type FrameAttributes = {
  frameBorderEnabled?: boolean;
  frameBorderColor?: string | null;
  frameBackgroundEnabled?: boolean;
  frameBackgroundColor?: string | null;
};

/**
 * Gera estilo de moldura para cada child block.
 * Considera primeiro overrides per-child (em `attributes`), depois cai no
 * default adaptativo derivado da cor de fundo do form (`textColor`).
 *  - per-child off → border: none / bg: transparent
 *  - per-child custom → usa cor escolhida pelo usuário
 *  - per-child default + fundo escuro → contorno/bg branquinhos
 *  - per-child default + fundo claro → contorno/bg pretos sutis
 *  - per-child default + sem cor → tema padrão (cor neutra)
 */
/**
 * Estilo aplicado no container dos children pra propagar a cor primária do form
 * via CSS variables (consumidas por Tailwind v4 + shadcn) e `accent-color`
 * (consumida por inputs nativos: checkbox, radio, range etc.).
 *
 * O projeto usa `oklch()` no theme, então passamos o hex direto — qualquer cor
 * CSS válida funciona quando referenciada por `var(--primary)`.
 */
function getPrimaryColorStyle(primaryColor?: string | null): CSSProperties {
  if (!primaryColor) return {};
  const style: CSSProperties = { accentColor: primaryColor };
  const overrides: Record<string, string> = {
    "--primary": primaryColor,
    "--ring": primaryColor,
    "--color-primary": primaryColor,
    "--color-ring": primaryColor,
  };
  Object.assign(style, overrides);
  return style;
}

function getFieldFrameStyle(
  child: FormBlockInstance,
  textColor?: string,
): CSSProperties {
  const attrs = (child.attributes ?? {}) as FrameAttributes;
  const borderEnabled = attrs.frameBorderEnabled !== false;
  const bgEnabled = attrs.frameBackgroundEnabled !== false;
  const customBorder = attrs.frameBorderColor;
  const customBg = attrs.frameBackgroundColor;

  let defaultBorder = "rgba(0,0,0,0.1)";
  let defaultBg = "rgba(0,0,0,0.025)";
  if (textColor === "#FFFFFF") {
    defaultBorder = "rgba(255,255,255,0.22)";
    defaultBg = "rgba(255,255,255,0.04)";
  } else if (textColor === "#000000") {
    defaultBorder = "rgba(0,0,0,0.12)";
    defaultBg = "rgba(0,0,0,0.025)";
  }

  const style: CSSProperties = {};
  style.border = borderEnabled
    ? `1px solid ${customBorder || defaultBorder}`
    : "1px solid transparent";
  style.backgroundColor = bgEnabled
    ? customBg || defaultBg
    : "transparent";
  if (textColor) style.color = textColor;

  return style;
}

export const RowLayoutBlock: ObjectBlockType = {
  blockCategory,
  blockType,

  createInstance: (id: string) => ({
    id: `layout-${id}`,
    blockType,
    isLocked: false,
    attributes: {},
    childblocks: [],
  }),

  blockBtnElement: {
    icon: Rows2,
    label: "Grupo",
  },

  canvasComponent: RowLayoutCanvasComponent,
  formComponent: RowLayoutFormComponent,
  propertiesComponent: RowLayoutPropertiesComponent,
};

function RowLayoutCanvasComponent({
  blockInstance,
  settings,
}: {
  blockInstance: FormBlockInstance;
  settings?: any;
}) {
  const {
    selectedBlockLayout,
    handleSelectedLayout,
    removeBlockLayout,
    duplicateBlockLayout,
    updateBlockLayout,
    selectedChildId,
    setSelectedChildId,
  } = useBuilderStore();

  const [activeBlock, setActiveBlock] = useState<Active | null>(null);

  const childBlocks = blockInstance.childblocks || [];

  const isSelected = selectedBlockLayout?.id === blockInstance.id;

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  const droppable = useDroppable({
    id: blockInstance.id,
    disabled: blockInstance.isLocked,
    data: {
      isLayoutDropArea: true,
    },
  });

  const draggable = useDraggable({
    id: blockInstance.id + "_drag-area",
    disabled: blockInstance.isLocked,
    data: {
      blockType: blockInstance.blockType,
      blockId: blockInstance.id,
      isCanvasLayout: true,
    },
  });

  useDndMonitor({
    onDragStart: (event) => {
      setActiveBlock(event.active);
    },
    onDragEnd: (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !active) return;
      setActiveBlock(null);

      const isBlockkBtnElement = active?.data?.current?.isBlockBtnElement;
      const isLayout = active.data?.current?.blockType;

      const overBlockId = over?.id;

      // 1) Drop de bloco novo (vindo do sidebar) sobre o RowLayout
      // Pode cair direto na área vazia do row (overId === row.id) ou sobre
      // um child existente desse row (sortable item) — em ambos os casos é
      // pra adicionar como filho deste row.
      const overData = over?.data?.current as
        | {
            isSortableChild?: boolean;
            parentId?: string;
            childId?: string;
          }
        | undefined;
      const overChildOfThisRow =
        overData?.isSortableChild === true &&
        overData?.parentId === blockInstance.id;

      if (
        isBlockkBtnElement &&
        !allBlockLayouts.includes(isLayout) &&
        (overBlockId === blockInstance.id || overChildOfThisRow) &&
        !blockInstance.isLocked
      ) {
        const blockType = active.data?.current?.blockType;
        const newBlock =
          FormBlocks[blockType as FormBlockType].createInstance(uuidv4());

        let updatedChildrenBlock: FormBlockInstance[];
        if (overChildOfThisRow && overData?.childId) {
          // Inserir logo depois do child sobre o qual foi solto
          const overIdx = childBlocks.findIndex(
            (c) => c.id === overData.childId,
          );
          if (overIdx >= 0) {
            updatedChildrenBlock = [
              ...childBlocks.slice(0, overIdx + 1),
              newBlock,
              ...childBlocks.slice(overIdx + 1),
            ];
          } else {
            updatedChildrenBlock = [...childBlocks, newBlock];
          }
        } else {
          updatedChildrenBlock = [...childBlocks, newBlock];
        }

        updateBlockLayout(blockInstance.id, updatedChildrenBlock);
        handleSelectedLayout({
          ...blockInstance,
          childblocks: updatedChildrenBlock,
        });
        return;
      }

      // 2) Reordenação de child blocks dentro do RowLayout (sortable)
      const isSortableActive = active?.data?.current?.isSortableChild;
      const isSortableOver = over?.data?.current?.isSortableChild;
      const sameParent =
        active?.data?.current?.parentId === blockInstance.id &&
        over?.data?.current?.parentId === blockInstance.id;

      if (
        isSortableActive &&
        isSortableOver &&
        sameParent &&
        active.id !== over.id &&
        !blockInstance.isLocked
      ) {
        const oldIndex = childBlocks.findIndex((c) => c.id === active.id);
        const newIndex = childBlocks.findIndex((c) => c.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const reordered = arrayMove(childBlocks, oldIndex, newIndex);
        updateBlockLayout(blockInstance.id, reordered);
      }
    },
  });

  function cycleChildWidth(childId: string) {
    const updated = childBlocks.map((c) => {
      if (c.id !== childId) return c;
      const current = getChildWidth(c);
      const idx = WIDTH_CYCLE.indexOf(current);
      const next = WIDTH_CYCLE[(idx + 1) % WIDTH_CYCLE.length];
      // Limpa atributo antigo `width` se ele estava sendo usado pra largura
      // de coluna (string), pra não conflitar com blocos que usam `width`
      // em pixels (ImageUpload/ImageDisplay).
      const prevAttrs = (c.attributes || {}) as Record<string, unknown>;
      const cleanedAttrs = { ...prevAttrs };
      if (
        typeof cleanedAttrs.width === "string" &&
        WIDTH_CYCLE.includes(cleanedAttrs.width as ChildWidth)
      ) {
        delete cleanedAttrs.width;
      }
      return {
        ...c,
        attributes: { ...cleanedAttrs, columnWidth: next },
      };
    });
    updateBlockLayout(blockInstance.id, updated);
  }

  function removeChildBlock(e: { stopPropagation: () => void }, id: string) {
    e.stopPropagation();
    const filteredBlock = childBlocks.filter((child) => child.id !== id);
    updateBlockLayout(blockInstance.id, filteredBlock);
  }

  function duplicateChildBlock(id: string) {
    const idx = childBlocks.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const original = childBlocks[idx];

    // Deep clone canônico via serialização. Garante zero compartilhamento
    // de referências (objetos aninhados, arrays, etc).
    const cloneAttrs = (a: unknown) =>
      a ? (JSON.parse(JSON.stringify(a)) as Record<string, unknown>) : {};

    // Re-gera ids únicos pra opções internas com `id` (radio/checkbox/dropdown
    // têm `attributes.options: [{id, label}]`). Sem isso, opções continuariam
    // com mesmos ids do original — pode causar conflito em sortable/keys.
    const regenOptionIds = (attrs: Record<string, unknown>) => {
      const opts = attrs.options;
      if (Array.isArray(opts)) {
        attrs.options = opts.map((o) =>
          o && typeof o === "object"
            ? { ...(o as Record<string, unknown>), id: `opt-${uuidv4()}` }
            : o,
        );
      }
      return attrs;
    };

    const duplicated: FormBlockInstance = {
      blockType: original.blockType,
      isLocked: original.isLocked,
      id: uuidv4(),
      attributes: regenOptionIds(cloneAttrs(original.attributes)),
      childblocks: original.childblocks
        ? original.childblocks.map((c) => ({
            blockType: c.blockType,
            isLocked: c.isLocked,
            id: uuidv4(),
            attributes: regenOptionIds(cloneAttrs(c.attributes)),
            childblocks: c.childblocks,
          }))
        : original.childblocks,
    };

    const updated = [
      ...childBlocks.slice(0, idx + 1),
      duplicated,
      ...childBlocks.slice(idx + 1),
    ];
    updateBlockLayout(blockInstance.id, updated);
  }

  if (draggable.isDragging) return;
  return (
    <div ref={draggable.setNodeRef} className="max-w-full ">
      {blockInstance.isLocked && <Border />}

      <Card
        ref={droppable.setNodeRef}
        className={cn(
          `w-full! bg-accent-foreground/10 relative border shadow-sm min-h-[120px] max-w-[768px] rounded-md p-0!`,
          blockInstance.isLocked && "rounded-t-none!",
        )}
        onClick={() => {
          handleSelectedLayout(blockInstance);
        }}
      >
        <CardContent className="px-2 pb-2">
          {isSelected && (
            <div className="w-[5px] absolute left-0 top-0 rounded-l-md h-full bg-primary" />
          )}
          {!blockInstance.isLocked && (
            <div
              {...draggable.listeners}
              {...draggable.attributes}
              role="button"
              className="flex items-center w-full h-[24px] cursor-move justify-center"
            >
              <GripHorizontal
                size="20px"
                className="text-muted-foreground"
                style={{ color: textColor || undefined }}
              />
            </div>
          )}

          <div className="w-full flex flex-wrap gap-2">
            {!allBlockLayouts.includes(activeBlock?.data?.current?.blockType) &&
              !blockInstance.isLocked &&
              activeBlock?.data?.current?.isBlockBtnElement &&
              droppable.isOver && (
                <div
                  className="relative border border-dotted 
                border-foreground bg-foreground/10 w-full h-28"
                >
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 text-xs bg-foreground text-muted-foreground hover:bg-foreground hover:text-white text-center w-28 p-1 rounded-b-full shadow-md">
                    Arraste o bloco aqui
                  </div>
                </div>
              )}

            {!droppable.isOver && childBlocks?.length == 0 ? (
              <PlaceHolder textColor={textColor} />
            ) : (
              <SortableContext
                items={childBlocks.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className={cn(
                    "flex w-full flex-row flex-wrap items-stretch gap-3 py-4 px-3",
                    getRowAlignClass(getRowAlign(blockInstance)),
                  )}
                  style={getPrimaryColorStyle(settings?.primaryColor)}
                >
                  {childBlocks?.map((childBlock) => (
                    <SortableChildCanvas
                      key={childBlock.id}
                      child={childBlock}
                      parentId={blockInstance.id}
                      isLayoutSelected={isSelected}
                      isLocked={blockInstance.isLocked}
                      textColor={textColor}
                      settings={settings}
                      isChildSelected={selectedChildId === childBlock.id}
                      onSelect={() => {
                        // Garante que o painel direito renderize: ele só
                        // aparece quando há um layout selecionado.
                        handleSelectedLayout(blockInstance);
                        setSelectedChildId(childBlock.id);
                      }}
                      onRemove={(e) => removeChildBlock(e, childBlock.id)}
                      onCycleWidth={() => cycleChildWidth(childBlock.id)}
                      onDuplicate={() => duplicateChildBlock(childBlock.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </CardContent>

        {isSelected && !blockInstance.isLocked && (
          <CardFooter className="flex items-center gap-3 justify-end border-t py-3">
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                duplicateBlockLayout(blockInstance.id);
              }}
            >
              <Copy style={{ color: textColor || undefined }} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                removeBlockLayout(blockInstance.id);
              }}
            >
              <Trash2Icon style={{ color: textColor || undefined }} />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function RowLayoutFormComponent({
  blockInstance,
  handleBlur,
  formErrors,
  settings,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  formErrors?: FormErrorsType;
  settings?: FormSettings | null;
}) {
  const childblocks = blockInstance.childblocks || [];

  const textColor = settings?.backgroundColor
    ? getContrastColor(settings.backgroundColor)
    : undefined;

  return (
    <div className="max-w-full">
      {blockInstance.isLocked && <Border />}

      {/* Grupo (RowLayout) no form público: SEM contorno/fundo/sombra própria.
          O contorno único do formulário fica no container externo (no
          form-submit-component). Manter o Card transparente evita
          "card-dentro-de-card" visual. */}
      <div
        className={cn("w-full relative min-h-[120px] max-w-[768px]")}
        style={{ color: textColor || undefined }}
      >
        <div className="px-2 pb-2 py-4">
          <div
            className={cn(
              "flex w-full flex-row flex-wrap items-stretch gap-3 px-3",
              getRowAlignClass(getRowAlign(blockInstance)),
            )}
            style={getPrimaryColorStyle(settings?.primaryColor)}
          >
            {childblocks.map((childblock) => {
              const width = getChildWidth(childblock);
              return (
                <div
                  key={childblock.id}
                  className={cn(
                    "flex items-stretch justify-center h-auto min-w-0",
                    getBasisClass(width),
                  )}
                >
                  <div
                    className="w-full min-w-0 rounded-md p-3 transition-colors"
                    style={getFieldFrameStyle(childblock, textColor)}
                  >
                    <ChildFormComponentWrapper
                      blockInstance={childblock}
                      handleBlur={handleBlur}
                      isError={!!formErrors?.[childblock.id]}
                      errorMessage={formErrors?.[childblock.id]}
                      settings={settings}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowLayoutPropertiesComponent({
  blockInstance,
}: {
  blockInstance: FormBlockInstance;
}) {
  const childblocks = blockInstance.childblocks || [];
  const { selectedChildId, setSelectedChildId, updateAnyBlock } =
    useBuilderStore();

  // Atualiza `rowAlign` no próprio RowLayout — afeta `justify-content` do
  // container flex que envolve os child blocks. Usa `updateAnyBlock` (sem
  // parentId) pra que o store mantenha `selectedBlockLayout` sincronizado.
  function commitRowAlign(value: RowAlign) {
    updateAnyBlock(blockInstance.id, {
      ...blockInstance,
      attributes: {
        ...(blockInstance.attributes ?? {}),
        rowAlign: value,
      },
    });
  }

  const currentAlign = getRowAlign(blockInstance);

  // Mostra só o child selecionado. Se não há nada selecionado, lista compacta
  // pra escolher (ou orientação pra clicar no canvas).
  const selectedChild = selectedChildId
    ? childblocks.find((c) => c.id === selectedChildId)
    : null;

  // Bloco "Alinhamento dos campos" — sempre visível no topo, mesmo sem
  // child selecionado. Permite escolher como os children se distribuem
  // horizontalmente quando não preenchem 100% da largura (ex: 2 blocos
  // de 33% cada, podem ficar à esquerda, centro, direita, ou separados).
  const alignmentSection = (
    <div className="px-4 pt-4 pb-3 space-y-2 border-b">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Alinhamento dos campos
      </div>
      <select
        className="w-full border rounded-md h-7 px-2 text-xs bg-transparent"
        value={currentAlign}
        onChange={(e) => commitRowAlign(e.target.value as RowAlign)}
      >
        {ROW_ALIGN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground leading-tight">
        {ROW_ALIGN_OPTIONS.find((o) => o.value === currentAlign)?.hint}
      </p>
    </div>
  );

  if (childblocks.length === 0) {
    return (
      <div>
        {alignmentSection}
        <div className="pt-4 px-4 text-xs text-muted-foreground italic">
          Adicione blocos arrastando da barra lateral.
        </div>
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div>
        {alignmentSection}
        <div className="pt-4 px-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Clique em um bloco no formulário para configurar suas propriedades.
          </p>
          <div className="flex flex-col gap-1 pt-2">
            {childblocks.map((c, idx) => {
              const label =
                (c.attributes?.label as string | undefined) ||
                (c.attributes?.title as string | undefined) ||
                FormBlocks[c.blockType]?.blockBtnElement.label ||
                c.blockType;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChildId(c.id)}
                  className="text-left text-xs px-2 py-1.5 rounded hover:bg-accent border border-transparent hover:border-border truncate"
                  title={label}
                >
                  <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const selectedIndex = childblocks.findIndex((c) => c.id === selectedChild.id);

  return (
    <div className="w-full">
      {alignmentSection}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Bloco {selectedIndex + 1} de {childblocks.length}
        </span>
        <button
          type="button"
          onClick={() => setSelectedChildId(null)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline"
        >
          desmarcar
        </button>
      </div>
      {/* `key={selectedChild.id}` força remontagem ao trocar de child,
          eliminando qualquer estado/closure stale entre seleções. */}
      <div
        key={selectedChild.id}
        className="w-full flex flex-col items-stretch justify-center gap-0 h-auto"
      >
        <ChildPropertiesComponentWrapper
          index={selectedIndex + 1}
          parentId={blockInstance.id}
          blockInstance={selectedChild}
        />
        <ChildFrameProperties
          parentId={blockInstance.id}
          child={selectedChild}
        />
      </div>
    </div>
  );
}

function ChildFrameProperties({
  parentId,
  child,
}: {
  parentId: string;
  child: FormBlockInstance;
}) {
  const { updateChildBlock } = useBuilderStore();
  const attrs = (child.attributes ?? {}) as FrameAttributes;
  const borderEnabled = attrs.frameBorderEnabled !== false;
  const bgEnabled = attrs.frameBackgroundEnabled !== false;
  const borderColor = attrs.frameBorderColor || "#9ca3af";
  const bgColor = attrs.frameBackgroundColor || "#f3f4f6";

  function commit(partial: Partial<FrameAttributes>) {
    updateChildBlock(parentId, child.id, {
      ...child,
      attributes: { ...(child.attributes ?? {}), ...partial },
    });
  }

  return (
    <div className="w-full px-4 pb-4 -mt-2 space-y-3 border-b">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">
        Aparência do campo
      </div>

      {/* Contorno */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-normal">Contorno</span>
          <Switch
            checked={borderEnabled}
            onCheckedChange={(v) => commit({ frameBorderEnabled: v })}
          />
        </div>
        {borderEnabled && (
          <div className="flex items-center gap-2 pl-2">
            <input
              type="color"
              value={borderColor}
              onChange={(e) => commit({ frameBorderColor: e.target.value })}
              className="w-8 h-8 rounded border cursor-pointer bg-transparent"
              aria-label="Cor do contorno"
            />
            <input
              type="text"
              value={attrs.frameBorderColor ?? ""}
              placeholder="auto (segue o tema)"
              onChange={(e) =>
                commit({ frameBorderColor: e.target.value || null })
              }
              className="flex-1 h-8 px-2 text-[12px] rounded border bg-background"
            />
            {attrs.frameBorderColor && (
              <button
                type="button"
                onClick={() => commit({ frameBorderColor: null })}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                title="Voltar ao automático"
              >
                limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fundo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-normal">Cor de fundo</span>
          <Switch
            checked={bgEnabled}
            onCheckedChange={(v) => commit({ frameBackgroundEnabled: v })}
          />
        </div>
        {bgEnabled && (
          <div className="flex items-center gap-2 pl-2">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => commit({ frameBackgroundColor: e.target.value })}
              className="w-8 h-8 rounded border cursor-pointer bg-transparent"
              aria-label="Cor de fundo"
            />
            <input
              type="text"
              value={attrs.frameBackgroundColor ?? ""}
              placeholder="auto (segue o tema)"
              onChange={(e) =>
                commit({ frameBackgroundColor: e.target.value || null })
              }
              className="flex-1 h-8 px-2 text-[12px] rounded border bg-background"
            />
            {attrs.frameBackgroundColor && (
              <button
                type="button"
                onClick={() => commit({ frameBackgroundColor: null })}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                title="Voltar ao automático"
              >
                limpar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortableChildCanvas({
  child,
  parentId,
  isLayoutSelected,
  isLocked,
  textColor,
  settings,
  isChildSelected,
  onSelect,
  onRemove,
  onCycleWidth,
  onDuplicate,
}: {
  child: FormBlockInstance;
  parentId: string;
  isLayoutSelected: boolean;
  isLocked?: boolean;
  textColor?: string;
  settings?: any;
  isChildSelected?: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onCycleWidth: () => void;
  onDuplicate: () => void;
}) {
  const width = getChildWidth(child);
  const sortable = useSortable({
    id: child.id,
    disabled: isLocked,
    data: {
      isSortableChild: true,
      parentId,
      childId: child.id,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch justify-center h-auto min-w-0 group/child",
        getBasisClass(width),
      )}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "relative w-full min-w-0 rounded-md transition-colors cursor-pointer",
          sortable.isDragging && "ring-2 ring-primary",
          // animate-pulse-ring usa box-shadow; não combinar com ring-* que
          // também usa box-shadow e sobrescreve a animação.
          isChildSelected && !sortable.isDragging && "animate-pulse-ring",
        )}
        style={getFieldFrameStyle(child, textColor)}
      >
        {!isLocked && (
          <div
            {...sortable.listeners}
            {...sortable.attributes}
            role="button"
            aria-label="Arrastar para reordenar"
            title="Arrastar para reordenar"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-7 flex flex-col items-center justify-center",
              "rounded-l-md cursor-grab active:cursor-grabbing select-none touch-none",
              "bg-foreground/[0.04] hover:bg-primary/15 transition-colors",
              "opacity-60 group-hover/child:opacity-100",
              sortable.isDragging && "bg-primary/25 opacity-100 cursor-grabbing",
              isChildSelected && "opacity-100 bg-primary/15",
            )}
            style={{ color: textColor || undefined }}
          >
            <GripVertical className="w-4 h-4" />
            <GripVertical className="w-4 h-4 -mt-2" />
          </div>
        )}

        <div className={cn("p-3", !isLocked && "pl-10")}>
          <ChildCanvasComponentWrapper
            blockInstance={child}
            settings={settings}
          />
        </div>

        {isLayoutSelected && !isLocked && (
          <ChildActionButtons
            width={width}
            textColor={textColor}
            onCycleWidth={onCycleWidth}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Botões flutuantes (largura/duplicar/remover) que adaptam suas cores ao
 * fundo do form pra continuarem visíveis em qualquer tema.
 *  - fundo escuro (textColor=#FFFFFF) → chip branco com texto escuro
 *  - fundo claro (textColor=#000000) → chip preto com texto branco
 *  - sem cor custom → segue o tema do sistema (popover-themed)
 */
function ChildActionButtons({
  width,
  textColor,
  onCycleWidth,
  onDuplicate,
  onRemove,
}: {
  width: ChildWidth;
  textColor?: string;
  onCycleWidth: () => void;
  onDuplicate: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  let chipStyle: CSSProperties;
  let chipDestructiveStyle: CSSProperties;
  if (textColor === "#FFFFFF") {
    // Form com fundo escuro → chips claros
    chipStyle = {
      backgroundColor: "rgba(255,255,255,0.95)",
      color: "#0a0a0a",
      borderColor: "rgba(0,0,0,0.1)",
    };
    chipDestructiveStyle = {
      ...chipStyle,
    };
  } else if (textColor === "#000000") {
    // Form com fundo claro → chips escuros
    chipStyle = {
      backgroundColor: "rgba(15,15,15,0.95)",
      color: "#fafafa",
      borderColor: "rgba(255,255,255,0.15)",
    };
    chipDestructiveStyle = { ...chipStyle };
  } else {
    // Sem custom — segue tema (deixa CSS resolver via classes)
    chipStyle = {};
    chipDestructiveStyle = {};
  }

  const useFallbackClasses = !textColor;

  return (
    <div className="absolute -top-2 right-2 flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCycleWidth();
        }}
        className={cn(
          "text-[10px] font-mono px-1.5 py-0.5 rounded border shadow-sm",
          useFallbackClasses && "bg-popover text-popover-foreground hover:bg-accent",
        )}
        style={chipStyle}
        title="Ajustar largura (clique pra ciclar)"
      >
        {WIDTH_LABEL[width]}
      </button>
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "size-6 border shadow-sm",
          useFallbackClasses && "bg-popover text-popover-foreground hover:bg-accent",
        )}
        style={chipStyle}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        title="Duplicar bloco"
      >
        <Copy className="w-3 h-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "size-6 border shadow-sm hover:bg-destructive! hover:text-destructive-foreground!",
          useFallbackClasses && "bg-popover text-popover-foreground",
        )}
        style={chipDestructiveStyle}
        onClick={onRemove}
        title="Remover bloco"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

function PlaceHolder({ textColor }: { textColor: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dotted border-muted-foreground rounded-md bg-accent/10 hover:bg-accent/5 w-full h-28 text-foreground font-medium text-base gap-1s">
      <p
        style={{ color: textColor || undefined }}
        className="
          text-center 
          "
      >
        Arraste e solte um bloco aqui para começar
      </p>
    </div>
  );
}

function Border() {
  return (
    <div className="w-full rounded-t-md min-h-[8px] bg-accent-foreground/10" />
  );
}
