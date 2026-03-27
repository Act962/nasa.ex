"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader, Save } from "lucide-react";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
          toast.error(error?.message || "Something went wrong");
        },
      },
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending || formData?.published}
      className={cn(
        formData?.published && "cursor-default pointer-events-none",
      )}
      onClick={saveFormData}
    >
      {mutation.isPending ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : (
        <Save />
      )}
      Save
    </Button>
  );
}
