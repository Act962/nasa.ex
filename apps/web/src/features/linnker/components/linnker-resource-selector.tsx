"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { LinnkerLinkType } from "../types";
import { Kanban, ClipboardType, Calendar, MessageSquareText, Loader2 } from "lucide-react";

interface Resource {
  id: string;
  name: string;
  url: string;
  description?: string;
}

interface Props {
  type: LinnkerLinkType;
  pageSlug: string;
  selectedId: string;
  onSelect: (resource: Resource) => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  TRACKING: <Kanban className="size-4 text-muted-foreground" />,
  FORM: <ClipboardType className="size-4 text-muted-foreground" />,
  AGENDA: <Calendar className="size-4 text-muted-foreground" />,
  CHAT: <MessageSquareText className="size-4 text-muted-foreground" />,
};

export function LinnkerResourceSelector({ type, pageSlug, selectedId, onSelect }: Props) {
  const { data, isLoading } = useQuery(
    orpc.linnker.getResources.queryOptions({}),
  );

  if (type === "EXTERNAL") return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const resources: Resource[] = (() => {
    if (!data) return [];
    if (type === "TRACKING") {
      return (data.trackings ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        // URL stores tracking id in query string — the actual link id is resolved at save time
        url: `${origin}/l/${pageSlug}/c/__LINK__?tracking=${t.id}`,
        description: "Captura de lead automaticamente",
      }));
    }
    if (type === "FORM") {
      return (data.forms ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        url: `${origin}/submit-form/${f.shareUrl}`,
        description: "Formulário público",
      }));
    }
    if (type === "AGENDA") {
      return (data.agendas ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        url: `${origin}/public/agenda/${data.orgSlug}/${a.slug}`,
        description: "Página de agendamento",
      }));
    }
    if (type === "CHAT") {
      return [
        {
          id: "whatsapp",
          name: "WhatsApp",
          url: "https://wa.me/",
          description: "Abre conversa no WhatsApp",
        },
      ];
    }
    return [];
  })();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="size-3 animate-spin" /> Carregando...
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        {type === "FORM"
          ? "Nenhum formulário publicado encontrado."
          : type === "AGENDA"
            ? "Nenhuma agenda encontrada."
            : "Nenhum item disponível."}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Selecione um item</p>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {resources.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors text-sm ${
              selectedId === r.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-muted-foreground hover:bg-muted/30"
            }`}
          >
            {TYPE_ICON[type]}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{r.name}</p>
              {r.description && (
                <p className="text-xs text-muted-foreground">{r.description}</p>
              )}
            </div>
            {selectedId === r.id && (
              <span className="text-primary text-xs font-medium shrink-0">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
