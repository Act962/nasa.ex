"use client";

import { useState } from "react";
import { useAdminToast } from "./use-admin-toast";

interface PopupTemplate {
  id?: string;
  name: string;
  type: "achievement" | "stars_reward" | "level_up";
  title: string;
  message: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  iconUrl?: string;
  enableConfetti: boolean;
  enableSound: boolean;
  dismissDuration: number;
  isActive?: boolean;
  customJson?: Record<string, unknown>;
}

export function usePopupTemplates(initialTemplates: PopupTemplate[]) {
  const toast = useAdminToast();
  const [templates, setTemplates] = useState<PopupTemplate[]>(initialTemplates);
  const [isLoading, setIsLoading] = useState(false);

  const updateTemplate = async (id: string, data: Partial<PopupTemplate>) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/popup-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update template");

      const updated = await response.json();
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      toast.success("Template atualizado com sucesso!");
      return updated;
    } catch (error) {
      toast.error("Erro ao atualizar template");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/popup-templates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success("Template deletado com sucesso!");
    } catch (error) {
      toast.error("Erro ao deletar template");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (data: Omit<PopupTemplate, "id">) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/popup-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create template");

      const created = await response.json();
      setTemplates(prev => [...prev, created]);
      toast.success("Template criado com sucesso!");
      return created;
    } catch (error) {
      toast.error("Erro ao criar template");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    templates,
    isLoading,
    updateTemplate,
    deleteTemplate,
    createTemplate,
  };
}
