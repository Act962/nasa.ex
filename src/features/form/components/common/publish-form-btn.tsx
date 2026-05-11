"use client";

import { Loader, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useMutationPublishForm,
  useMutationUpdateForm,
} from "../../hooks/use-form";

export function PublishFormBtn() {
  const { formData, setFormData, blockLayouts } = useBuilderStore();
  const id = formData?.id;
  const mutate = useMutationPublishForm();
  const saveMutate = useMutationUpdateForm();

  const togglePublishState = async () => {
    if (!id) return;

    // 1) Salvar o estado atual (jsonBlock + settings) ANTES de publicar
    //    pra evitar publicar uma versão desatualizada caso haja mudanças
    //    pendentes ainda no debounce do auto-save.
    const currentSettings = formData?.settings;
    try {
      await saveMutate.mutateAsync({
        id,
        jsonBlock: JSON.stringify(blockLayouts),
        ...(currentSettings && {
          settings: {
            primaryColor: currentSettings.primaryColor,
            backgroundColor: currentSettings.backgroundColor,
            backgroundImage: currentSettings.backgroundImage,
            trackingId: currentSettings.trackingId,
            statusId: currentSettings.statusId,
            showName: currentSettings.showName,
            showEmail: currentSettings.showEmail,
            showPhone: currentSettings.showPhone,
            needLogin: currentSettings.needLogin,
            finishMessage: currentSettings.finishMessage,
            redirectUrl: currentSettings.redirectUrl,
            idPixel: currentSettings.idPixel,
            idTagManager: currentSettings.idTagManager,
            stepMode:
              ((currentSettings as unknown) as { stepMode?: string })
                .stepMode || "off",
            nextButtonLabel:
              ((currentSettings as unknown) as { nextButtonLabel?: string })
                .nextButtonLabel || "Próximo",
            ...(Array.isArray(
              ((currentSettings as unknown) as {
                progressMascots?: unknown;
              }).progressMascots,
            ) && {
              progressMascots: ((currentSettings as unknown) as {
                progressMascots?: Array<{
                  min: number;
                  max: number;
                  label: string;
                  emoji?: string;
                  imageUrl?: string;
                }>;
              }).progressMascots,
            }),
            ...(typeof ((currentSettings as unknown) as {
              nextButtonAction?: unknown;
            }).nextButtonAction === "object" &&
            ((currentSettings as unknown) as { nextButtonAction?: unknown })
              .nextButtonAction !== null
              ? {
                  nextButtonAction: ((currentSettings as unknown) as {
                    nextButtonAction?: {
                      type: "next_block" | "form" | "external_link" | "add_tag";
                      formId?: string | null;
                      externalUrl?: string | null;
                      tagId?: string | null;
                      passLeadData?: boolean;
                    };
                  }).nextButtonAction,
                }
              : {}),
          },
        }),
      });
    } catch {
      toast.error("Falha ao salvar antes de publicar");
      return;
    }

    // 2) Toggle do flag published
    mutate.mutate(
      { id, published: !formData?.published },
      {
        onSuccess: (response) => {
          toast.success(
            response.published
              ? "Formulário publicado!"
              : "Formulário despublicado",
          );
          setFormData({
            ...formData,
            published: response.published || false,
          });
        },
        onError: () => {
          toast.error("Falha ao publicar formulário");
        },
      },
    );
  };

  const isPublished = formData?.published;

  return (
    <Button
      disabled={mutate.isPending || saveMutate.isPending}
      size="sm"
      variant={isPublished ? "destructive" : "secondary"}
      className={cn(isPublished && "bg-red-500 hover:bg-red-600", "text-white")}
      onClick={togglePublishState}
    >
      {mutate.isPending || saveMutate.isPending ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : isPublished ? (
        "Despublicar"
      ) : (
        <>
          <Send />
          Publicar
        </>
      )}
    </Button>
  );
}
