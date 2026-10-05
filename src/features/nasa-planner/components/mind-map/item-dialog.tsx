"use client";

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { POST_TYPE_META, POST_TYPES } from "../v2/planner-v2-utils";

/** Criar ou editar um item do mapa (card de conteúdo, link, nota ou tópico). Vira gaveta de baixo no celular. */

export type MapItemKind = "post" | "link" | "note" | "topic";

export interface MapItemValues {
  title: string;
  url: string;
  format: NasaPlannerPostType;
}

export type MapItemRequest =
  | { mode: "create"; kind: MapItemKind; parentId: string; parentLabel?: string }
  | { mode: "edit"; kind: MapItemKind; nodeId: string; initial: Partial<MapItemValues>; postId?: string };

const KIND_LABEL: Record<MapItemKind, { create: string; edit: string; placeholder: string }> = {
  post: { create: "Novo card de conteúdo", edit: "Card de conteúdo", placeholder: "Tema do conteúdo. Ex.: 7 sinais de que…" },
  link: { create: "Novo link", edit: "Link", placeholder: "Nome do link. Ex.: Referência de reels" },
  note: { create: "Nova nota", edit: "Nota", placeholder: "Lembrete ou observação" },
  topic: { create: "Novo tópico", edit: "Tópico", placeholder: "Nome do tópico" },
};

const SHEET_ON_MOBILE =
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[26px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100";

function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function ItemForm({ request, onSave, onDelete, onOpenPost, onClose }: { request: MapItemRequest; onSave: (values: MapItemValues) => void; onDelete?: () => void; onOpenPost?: (postId: string) => void; onClose: () => void }) {
  const initial = request.mode === "edit" ? request.initial : {};
  const [title, setTitle] = useState(initial.title ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [format, setFormat] = useState<NasaPlannerPostType>(initial.format ?? "REEL");
  const labels = KIND_LABEL[request.kind];
  const linkedPostId = request.mode === "edit" ? request.postId : undefined;
  const normalizedUrl = normalizeUrl(url);
  const canSave = request.kind === "link" ? normalizedUrl.length > 0 : title.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    onSave({ title: title.trim(), url: normalizedUrl, format });
    onClose();
  };

  return (
    <div className="space-y-3">
      <DialogHeader className="text-left">
        <DialogTitle>{request.mode === "create" ? labels.create : labels.edit}</DialogTitle>
        <DialogDescription>
          {request.mode === "create" && request.parentLabel
            ? `Dentro de "${request.parentLabel}".`
            : linkedPostId
              ? "Este card é um post do Planner. O texto e o status vêm de lá."
              : request.kind === "post"
                ? "Vira uma pauta no Planner quando você usar Criar conteúdos."
                : "Edite ou apague este item do mapa."}
        </DialogDescription>
      </DialogHeader>

      {!linkedPostId &&
        (request.kind === "note" ? (
          <Textarea autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={labels.placeholder} className="min-h-24 rounded-2xl text-base sm:text-sm" />
        ) : (
          <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && save()} placeholder={labels.placeholder} className="h-11 rounded-full text-base sm:text-sm" />
        ))}

      {request.kind === "link" && (
        <Input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => event.key === "Enter" && save()} placeholder="https://…" inputMode="url" className="h-11 rounded-full text-base sm:text-sm" />
      )}

      {request.kind === "post" && !linkedPostId && (
        <div className="flex flex-wrap gap-1.5">
          {POST_TYPES.map((type) => {
            const TypeIcon = POST_TYPE_META[type].icon;
            return (
              <button key={type} type="button" onClick={() => setFormat(type)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm", format === type ? "bg-foreground font-semibold text-background" : "bg-panel")}>
                <TypeIcon className="size-3.5" /> {POST_TYPE_META[type].label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {onDelete && (
          <button type="button" aria-label="Apagar do mapa" onClick={() => { onDelete(); onClose(); }} className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-4" />
          </button>
        )}
        {request.kind === "link" && request.mode === "edit" && normalizedUrl && (
          <a href={normalizedUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-panel px-4 text-sm font-medium">
            <ExternalLink className="size-4" /> Abrir link
          </a>
        )}
        {linkedPostId && onOpenPost ? (
          <button type="button" onClick={() => onOpenPost(linkedPostId)} className="h-11 flex-1 rounded-full bg-foreground px-5 text-sm font-semibold text-background">
            Abrir no Planner
          </button>
        ) : (
          <button type="button" disabled={!canSave} onClick={save} className="h-11 flex-1 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40">
            {request.mode === "create" ? "Adicionar" : "Salvar"}
          </button>
        )}
      </div>
    </div>
  );
}

export function MapItemDialog(props: { request: MapItemRequest | null; onSave: (values: MapItemValues) => void; onDelete?: () => void; onOpenPost?: (postId: string) => void; onClose: () => void }) {
  const { request } = props;
  return (
    <Dialog open={Boolean(request)} onOpenChange={(isOpen) => !isOpen && props.onClose()}>
      <DialogContent className={cn("rounded-[22px] sm:max-w-md", SHEET_ON_MOBILE)}>
        {request && <ItemForm key={request.mode === "edit" ? request.nodeId : `${request.kind}-${request.parentId}`} {...props} request={request} />}
      </DialogContent>
    </Dialog>
  );
}
