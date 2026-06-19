"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUploadFiscalCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      arquivo,
      senha,
    }: {
      arquivo: File;
      senha: string;
    }) => {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("senha", senha);

      const response = await fetch("/api/focus-nfe/certificado", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Erro ao enviar certificado",
        );
      }

      return response.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}
