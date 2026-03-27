"use client";

import { Loader, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutationPublishForm } from "../../hooks/use-form";

export function PublishFormBtn() {
  const { formData, setFormData } = useBuilderStore();
  const id = formData?.id;
  const mutate = useMutationPublishForm();

  const togglePublishState = async () => {
    if (!id) return;

    // Toggle published state
    !formData?.published;
    mutate.mutate(
      { id, published: !formData?.published },
      {
        onSuccess: (response) => {
          toast.success("formumário publicado!");
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
      disabled={mutate.isPending}
      size="sm"
      variant={isPublished ? "destructive" : "secondary"}
      className={cn(isPublished && "bg-red-500 hover:bg-red-600", "text-white")}
      onClick={togglePublishState}
    >
      {mutate.isPending ? (
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
