"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useBackgroundRemoval() {
  const [isRemoving, setIsRemoving] = useState(false);

  const removeBackground = useCallback(async (imageElement: HTMLImageElement): Promise<Blob | null> => {
    setIsRemoving(true);
    try {
      const { removeBackground: removeBg } = await import("@imgly/background-removal");
      const toastId = toast.loading("Removendo fundo da imagem...");
      const result = await removeBg(imageElement.src);
      toast.dismiss(toastId);
      toast.success("Fundo removido!");
      return result;
    } catch (err: any) {
      toast.error("Erro ao remover fundo. Tente novamente.");
      console.error("[BG Removal]", err?.message);
      return null;
    } finally {
      setIsRemoving(false);
    }
  }, []);

  return { removeBackground, isRemoving };
}
