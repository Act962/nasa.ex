"use client";
import { Button } from "@/components/ui/button";
import { LoaderIcon, SaveIcon } from "lucide-react";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { toast } from "sonner";
import { useMutationUpdateForm } from "@/features/form/hooks/use-form";

export function SaveFormBtn() {
  const { formData, setFormData, blockLayouts } = useBuilderStore();
  const mutation = useMutationUpdateForm();
  const id = formData?.id;

  const saveFormData = () => {
    if (!id) {
      toast.error("Form ID is required");
      return;
    }

    const lockedBlockLayout = blockLayouts.find((block) => block.isLocked);

    const name = lockedBlockLayout?.childblocks?.find(
      (child) => child.blockType === "Heading",
    )?.attributes?.label as string;

    const description = lockedBlockLayout?.childblocks?.find(
      (child) => child.blockType === "Paragraph",
    )?.attributes?.text as string;

    const jsonBlocks = JSON.stringify(blockLayouts);

    mutation.mutate(
      {
        id,
        name,
        description,
        jsonBlock: jsonBlocks,
        settings: formData?.settings
          ? {
              primaryColor: formData.settings.primaryColor,
              backgroundColor: formData.settings.backgroundColor,
              backgroundImage: formData.settings.backgroundImage,
              trackingId: formData.settings.trackingId,
              statusId: formData.settings.statusId,
              showName: formData.settings.showName,
              showEmail: formData.settings.showEmail,
              showPhone: formData.settings.showPhone,
              needLogin: formData.settings.needLogin,
              finishMessage: formData.settings.finishMessage,
              redirectUrl: formData.settings.redirectUrl,
              idPixel: formData.settings.idPixel,
              idTagManager: formData.settings.idTagManager,
              stepMode:
                ((formData.settings as unknown) as { stepMode?: string })
                  .stepMode || "off",
              nextButtonLabel:
                ((formData.settings as unknown) as {
                  nextButtonLabel?: string;
                }).nextButtonLabel || "Próximo",
              ...(Array.isArray(
                ((formData.settings as unknown) as {
                  progressMascots?: unknown;
                }).progressMascots,
              ) && {
                progressMascots: ((formData.settings as unknown) as {
                  progressMascots?: Array<{
                    min: number;
                    max: number;
                    label: string;
                    emoji?: string;
                    imageUrl?: string;
                  }>;
                }).progressMascots,
              }),
              ...(typeof ((formData.settings as unknown) as {
                nextButtonAction?: unknown;
              }).nextButtonAction === "object" &&
              ((formData.settings as unknown) as { nextButtonAction?: unknown })
                .nextButtonAction !== null
                ? {
                    nextButtonAction: ((formData.settings as unknown) as {
                      nextButtonAction?: {
                        type:
                          | "next_block"
                          | "form"
                          | "external_link"
                          | "add_tag";
                        formId?: string | null;
                        externalUrl?: string | null;
                        tagId?: string | null;
                        passLeadData?: boolean;
                      };
                    }).nextButtonAction,
                  }
                : {}),
              ...(Array.isArray(
                ((formData.settings as unknown) as {
                  whatsappChats?: unknown;
                }).whatsappChats,
              ) && {
                whatsappChats: ((formData.settings as unknown) as {
                  whatsappChats?: Array<{ chatId: string; chatName: string }>;
                }).whatsappChats,
              }),
              whatsappMessage:
                ((formData.settings as unknown) as {
                  whatsappMessage?: string | null;
                }).whatsappMessage ?? null,
            }
          : undefined,
      },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          if (response.form) {
            setFormData({
              ...formData,
              ...response.form,
            });
          }
        },
        onError: (error) => {
          toast.error(error?.message || "Algo deu errado");
        },
      },
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={saveFormData}
    >
      {mutation.isPending ? (
        <LoaderIcon className="w-4 h-4 animate-spin" />
      ) : (
        <SaveIcon />
      )}
      Salvar
    </Button>
  );
}
