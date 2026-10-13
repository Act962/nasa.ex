"use client";

import {
  DownloadIcon, FileJsonIcon, ImageIcon, LayoutListIcon, Link2Icon, MoreHorizontalIcon, PlusIcon,
  Redo2Icon, RefreshCwIcon, SaveIcon, SearchIcon, SparklesIcon, StickyNoteIcon, Undo2Icon, WorkflowIcon, ZapIcon,
} from "lucide-react";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MapItemKind } from "./item-dialog";

/** Ações do editor de mapa mental: na barra de cima no computador e no menu de baixo no celular. */

export interface MindMapToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isWeekly: boolean;
  pendingContentCount: number;
}

export interface MindMapToolbarActions {
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onSearchInMap: () => void;
  onAddItem: (kind: MapItemKind) => void;
  onAddActionCard: () => void;
  onOrganize: () => void;
  onSyncWithScript: () => void;
  onOpenContents: () => void;
  onExportPng: () => void;
  onExportJson: () => void;
  onSave: () => void;
}

interface ToolbarProps {
  state: MindMapToolbarState;
  actions: MindMapToolbarActions;
}

export function MindMapDesktopActions({ state, actions }: ToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 max-md:hidden">
      <Button size="icon" variant="ghost" onClick={actions.onUndo} disabled={!state.canUndo} title="Desfazer (Ctrl+Z)" className="size-8 rounded-full">
        <Undo2Icon className="size-3.5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={actions.onRedo} disabled={!state.canRedo} title="Refazer (Ctrl+Y)" className="size-8 rounded-full">
        <Redo2Icon className="size-3.5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={actions.onToggleSearch} title="Buscar (Ctrl+F)" className="size-8 rounded-full">
        <SearchIcon className="size-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => actions.onAddItem("topic")}>
        <PlusIcon className="size-3.5" /> Tópico
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => (state.isWeekly ? actions.onAddItem("post") : actions.onAddActionCard())}>
        <ZapIcon className="size-3.5" /> Card
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => actions.onAddItem("link")}>
        <Link2Icon className="size-3.5" /> Link
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => actions.onAddItem("note")}>
        <StickyNoteIcon className="size-3.5" /> Nota
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={actions.onOrganize}>
        <WorkflowIcon className="size-3.5" /> Organizar
      </Button>
      {state.isWeekly && (
        <>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={actions.onSyncWithScript}>
            <RefreshCwIcon className="size-3.5" /> Atualizar com o roteiro
          </Button>
          <Button size="sm" className="h-8 gap-1.5 rounded-full" onClick={actions.onOpenContents}>
            <SparklesIcon className="size-3.5" /> Criar conteúdos{state.pendingContentCount > 0 && ` (${state.pendingContentCount})`}
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" title="Exportar" className="size-8 rounded-full">
            <DownloadIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={actions.onExportPng}>
            <ImageIcon className="mr-2 size-3.5" /> PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={actions.onExportJson}>
            <FileJsonIcon className="mr-2 size-3.5" /> JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="icon" variant="ghost" onClick={actions.onSave} disabled={state.isSaving} title="Salvar agora" className="size-8 rounded-full">
        <SaveIcon className="size-3.5" />
      </Button>
      <FullscreenControls />
    </div>
  );
}

export function MindMapMobileMenu({ state, actions }: ToolbarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-card p-1.5 shadow-xl">
        <button type="button" aria-label="Desfazer" onClick={actions.onUndo} disabled={!state.canUndo} className="grid size-11 place-items-center rounded-full disabled:opacity-30">
          <Undo2Icon className="size-4" />
        </button>
        <button type="button" aria-label="Organizar" onClick={actions.onOrganize} className="grid size-11 place-items-center rounded-full">
          <WorkflowIcon className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background">
              <PlusIcon className="size-4" /> Adicionar
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-56 rounded-[18px] p-1.5">
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => actions.onAddItem("topic")}>
              <WorkflowIcon className="size-4" /> Tópico
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => (state.isWeekly ? actions.onAddItem("post") : actions.onAddActionCard())}>
              <LayoutListIcon className="size-4" /> Card
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => actions.onAddItem("link")}>
              <Link2Icon className="size-4" /> Link
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={() => actions.onAddItem("note")}>
              <StickyNoteIcon className="size-4" /> Nota
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {state.isWeekly && (
          <button type="button" aria-label="Criar conteúdos" onClick={actions.onOpenContents} className="relative grid size-11 place-items-center rounded-full">
            <SparklesIcon className="size-4" />
            {state.pendingContentCount > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white">{state.pendingContentCount}</span>}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Mais ações" className="grid size-11 place-items-center rounded-full">
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-60 rounded-[18px] p-1.5">
            {state.isWeekly && (
              <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={actions.onSyncWithScript}>
                <RefreshCwIcon className="size-4" /> Atualizar com o roteiro
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={actions.onRedo} disabled={!state.canRedo}>
              <Redo2Icon className="size-4" /> Refazer
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={actions.onSearchInMap}>
              <SearchIcon className="size-4" /> Buscar no mapa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={actions.onExportPng}>
              <ImageIcon className="size-4" /> Exportar PNG
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onSelect={actions.onExportJson}>
              <FileJsonIcon className="size-4" /> Exportar JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
