"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutationPublishForm } from "../../hooks/use-form";

export function PublishFormBtn() {
  const { formData, setFormData, handleSelectedLayout } = useBuilderStore();
  const mutation = useMutationPublishForm();

  const id = formData?.id;

  const togglePublishState = async () => {
    if (!id) return;
    const newPublishedState = !formData?.published;

    mutation.mutate(
      {
        id,
        published: newPublishedState,
      },
      {
        onSuccess: (data) => {
          toast("Formulário publicado com sucesso");
          handleSelectedLayout(null);
          setFormData({
            ...formData,
            published: data.published,
          });
        },
        onError: () => {
          toast("Falha ao publicar formulário");
        },
      },
    );
  };

  const isPublished = formData?.published;

  return (
    <Button
      disabled={mutation.isPending}
      size="sm"
      variant={isPublished ? "destructive" : "default"}
      className={cn(
        isPublished ? "bg-destructive hover:bg-destructive" : "bg-primary!",
        "text-white",
      )}
      onClick={togglePublishState}
    >
      {mutation.isPending ? (
        <OrbitaSpinner className="w-4 h-4 " />
      ) : isPublished ? (
        "Unpublish"
      ) : (
        <>
          <Send />
          Publish
        </>
      )}
    </Button>
  );
}
