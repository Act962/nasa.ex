"use client";

import { useToast } from "@/contexts/toast-context";

export function useAdminToast() {
  const { showToast } = useToast();

  return {
    // Método genérico
    show: (message: string, type: "success" | "error" | "info" | "warning" = "info", duration = 4000) => {
      showToast(message, type, duration);
    },

    // Atalhos convenientes
    success: (message: string, duration = 4000) => {
      showToast(message, "success", duration);
    },

    error: (message: string, duration = 4000) => {
      showToast(message, "error", duration);
    },

    warning: (message: string, duration = 4000) => {
      showToast(message, "warning", duration);
    },

    info: (message: string, duration = 4000) => {
      showToast(message, "info", duration);
    },

    // Para operações assíncronas
    async: async <T,>(
      promise: Promise<T>,
      messages: {
        loading?: string;
        success?: string;
        error?: string;
      }
    ): Promise<T> => {
      if (messages.loading) {
        showToast(messages.loading, "info", 0); // Não fecha automaticamente
      }

      try {
        const result = await promise;
        if (messages.success) {
          showToast(messages.success, "success", 4000);
        }
        return result;
      } catch (err) {
        const errorMessage =
          messages.error ||
          (err instanceof Error ? err.message : "Ocorreu um erro");
        showToast(errorMessage, "error", 5000);
        throw err;
      }
    },
  };
}
