"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon, EyeIcon, Link2Icon, PlusIcon, Settings2Icon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { BuilderSaveStatus } from "@/features/form/components/common/builder-save-status";
import { PublishFormBtn } from "@/features/form/components/common/publish-form-btn";
import { BuilderCanvas } from "../builder-canvas";
import { AddBlockSheet } from "./add-block-sheet";
import { BlockEditSheet, FormSettingsSheet, MobilePreviewDialog } from "./mobile-builder-sheets";
import { useMobileBuilderStore } from "./use-mobile-builder-store";

/**
 * Construtor no celular: o formulário em tela cheia, o menu em órbita com "+ Bloco"
 * no centro (no lugar do ASTRO) e gavetas para blocos, edição e ajustes.
 */
export function MobileFormBuilder() {
  const { formData, undo, canUndo } = useBuilderStore();
  const setOpenPanel = useMobileBuilderStore((state) => state.setOpenPanel);
  const router = useRouter();

  const copyPublicLink = () => {
    if (!formData?.published) {
      toast("Publique o formulário para ter o link de compartilhamento.");
      return;
    }
    const publicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/submit-form/${formData.id}`;
    navigator.clipboard
      .writeText(publicLink)
      .then(() => toast.success("Link copiado!"))
      .catch(() => toast.error("Não consegui copiar o link."));
  };

  useRegisterOrbitDock({
    leftItems: [
      {
        label: "Desfazer",
        icon: <Undo2Icon />,
        onSelect: () => {
          if (!canUndo()) {
            toast("Nada para desfazer.");
            return;
          }
          undo();
        },
      },
      { label: "Ajustes", icon: <Settings2Icon />, onSelect: () => setOpenPanel("settings") },
    ],
    rightItems: [
      { label: "Prévia", icon: <EyeIcon />, onSelect: () => setOpenPanel("preview") },
      { label: "Link", icon: <Link2Icon />, onSelect: copyPublicLink },
    ],
    centerAction: { label: "Bloco", icon: <PlusIcon />, onSelect: () => setOpenPanel("add-block") },
  });

  return (
    <div className="flex h-[100svh] w-full flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <button
          type="button"
          aria-label="Voltar para os formulários"
          onClick={() => router.push("/form")}
          className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full bg-knob active:scale-95"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{formData?.name ?? "Formulário"}</h1>
        {/* O status também liga o salvamento automático — sem ele no celular, nada salvaria. */}
        <BuilderSaveStatus isCompact />
        <PublishFormBtn />
      </header>
      <div className="min-h-0 flex-1">
        <BuilderCanvas />
      </div>
      <AddBlockSheet />
      <BlockEditSheet />
      <FormSettingsSheet />
      <MobilePreviewDialog />
    </div>
  );
}
