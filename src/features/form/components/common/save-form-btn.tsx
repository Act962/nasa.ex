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
