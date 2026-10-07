"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import type { FormBlockType } from "@/features/form/types";
import { useMobileBuilderStore } from "./use-mobile-builder-store";

/** Gaveta "+ Bloco" do celular: categorias, busca e nomes completos; tocar adiciona ao fim do formulário. */

const BLOCK_CATEGORIES: Array<{ id: string; label: string; blockTypes: FormBlockType[] }> = [
  { id: "fields", label: "Campos", blockTypes: ["TextField", "TextArea", "MaskedField", "DatePicker", "Url", "StarRating", "Slider", "NumberMeasure"] },
  { id: "records", label: "Itens e cálculo", blockTypes: ["ItemList", "Calculation", "ImageMarker", "OrbitLookup"] },
  { id: "choices", label: "Escolha", blockTypes: ["RadioSelect", "Checkbox", "Dropdown", "RadioMatrix", "UserSelect", "MultiUserSelect"] },
  { id: "structure", label: "Estrutura", blockTypes: ["Heading", "Paragraph", "ParagraphWithTitle", "ImageDisplay", "PageBreak", "RowLayout"] },
  { id: "files", label: "Arquivos e assinatura", blockTypes: ["FileUpload", "ImageUpload", "QrCodeMulti", "SignatureUser", "SignatureClient"] },
];

/** Rola o canvas até o fim, onde o bloco novo entrou. */
function scrollCanvasToEnd() {
  window.setTimeout(() => {
    const canvas = document.querySelector<HTMLElement>("[data-builder-canvas]");
    canvas?.scrollTo({ top: canvas.scrollHeight, behavior: "smooth" });
  }, 80);
}

export function AddBlockSheet() {
  const openPanel = useMobileBuilderStore((state) => state.openPanel);
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  const { formData, selectedBlockLayout, addBlockLayout, updateBlockLayout, handleSelectedLayout, setSelectedChildId } = useBuilderStore();
  const [searchText, setSearchText] = useState("");
  const [categoryId, setCategoryId] = useState(BLOCK_CATEGORIES[0].id);

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleBlockTypes = normalizedSearch
    ? BLOCK_CATEGORIES.flatMap((category) => category.blockTypes).filter((blockType) =>
        FormBlocks[blockType]?.blockBtnElement.label.toLowerCase().includes(normalizedSearch),
      )
    : (BLOCK_CATEGORIES.find((category) => category.id === categoryId)?.blockTypes ?? []);

  const addBlock = (blockType: FormBlockType) => {
    const formBlock = FormBlocks[blockType];
    if (!formBlock) return;
    const isEmptyGroup = blockType === "RowLayout";
    const newChild = isEmptyGroup ? null : formBlock.createInstance(uuidv4());

    // Formulário publicado não ganha grupo novo (quem já respondeu veria um passo a mais): o campo entra no grupo selecionado.
    if (formData?.published) {
      if (isEmptyGroup || !selectedBlockLayout || selectedBlockLayout.isLocked) {
        toast("Formulário publicado: toque num grupo e adicione o campo dentro dele.");
        return;
      }
      if (newChild) {
        updateBlockLayout(selectedBlockLayout.id, [...(selectedBlockLayout.childblocks ?? []), newChild]);
        setSelectedChildId(newChild.id);
      }
      setOpenPanel(null);
      return;
    }

    const newGroup = FormBlocks.RowLayout.createInstance(`layout-${uuidv4()}`);
    const groupWithChild = newChild ? { ...newGroup, childblocks: [newChild] } : newGroup;
    addBlockLayout(groupWithChild);
    handleSelectedLayout(groupWithChild);
    if (newChild) setSelectedChildId(newChild.id);
    setOpenPanel(null);
    setSearchText("");
    scrollCanvasToEnd();
  };

  return (
    <Sheet open={openPanel === "add-block"} onOpenChange={(isOpen) => setOpenPanel(isOpen ? "add-block" : null)}>
      <SheetContent side="bottom" className="max-h-[80svh] gap-3 rounded-t-[26px] px-4 pb-6">
        <SheetHeader className="p-0 pt-2">
          <SheetTitle className="text-base">Adicionar bloco</SheetTitle>
        </SheetHeader>

        <label className="flex h-10 items-center gap-2 rounded-full bg-panel px-4 text-sm">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar bloco"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        {!normalizedSearch && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {BLOCK_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
                  categoryId === category.id ? "bg-foreground text-background" : "bg-panel text-muted-foreground",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-2">
          {visibleBlockTypes.map((blockType) => {
            const formBlock = FormBlocks[blockType];
            if (!formBlock) return null;
            const BlockIcon = formBlock.blockBtnElement.icon;
            return (
              <button
                key={blockType}
                type="button"
                onClick={() => addBlock(blockType)}
                className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-panel px-1.5 py-2.5 text-center text-[11.5px] font-semibold leading-tight transition-colors active:bg-knob"
              >
                <BlockIcon className="size-5" />
                {formBlock.blockBtnElement.label}
              </button>
            );
          })}
          {visibleBlockTypes.length === 0 && (
            <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">Nenhum bloco com esse nome.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
