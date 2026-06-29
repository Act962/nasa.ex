import {
  LayoutGrid,
  Columns2,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ContextSelectorProps } from "./types";

export function ContextSelector({
  workspaces,
  columns,
  selectedWorkspaceId,
  selectedColumnId,
  selectedWorkspaceName,
  selectedColumnName,
  onSelectWorkspace,
  onSelectColumn,
}: ContextSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 hover:bg-zinc-800 transition-all group rounded-lg"
        >
          <div className="flex items-center gap-2 overflow-hidden text-left">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <LayoutGrid className="size-3 text-purple-500" />
              <span className="truncate max-w-[100px]">
                {selectedWorkspaceName || "Workspace"}
              </span>
            </div>
            <ChevronRight className="size-2.5 text-zinc-700" />
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <Columns2 className="size-3 text-blue-500" />
              <span className="truncate max-w-[100px]">
                {selectedColumnName || "Coluna"}
              </span>
            </div>
            <ChevronDown className="size-3 text-zinc-600 ml-1" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[280px] bg-zinc-950 border-zinc-800 rounded-xl p-1 shadow-2xl"
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2 py-1.5">
          Alternar Contexto
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />

        {workspaces.map((w) => (
          <DropdownMenuSub key={w.id}>
            <DropdownMenuSubTrigger
              onClick={() => onSelectWorkspace(w.id)}
              className={cn(
                "rounded-lg px-2 flex items-center justify-between transition-colors",
                selectedWorkspaceId === w.id &&
                  "bg-purple-500/10 text-purple-400",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{w.icon || "🏢"}</span>
                <span className="text-sm font-medium">{w.name}</span>
              </div>
              {selectedWorkspaceId === w.id && (
                <Check className="size-3.5 ml-2" />
              )}
            </DropdownMenuSubTrigger>

            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-zinc-950 border-zinc-800 rounded-xl p-1 min-w-[180px] shadow-xl">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2 py-1.5">
                  Colunas do Fluxo
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />

                {selectedWorkspaceId === w.id ? (
                  columns.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => onSelectColumn(w.id, c.id)}
                      className={cn(
                        "rounded-lg px-3 flex items-center justify-between py-2 transition-colors",
                        selectedColumnId === c.id &&
                          "bg-blue-500/10 text-blue-400 font-medium",
                      )}
                    >
                      <div className="flex items-center gap-2 text-left overflow-hidden">
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.color || "#3b82f6" }}
                        />
                        <span className="text-sm truncate">{c.name}</span>
                      </div>
                      {selectedColumnId === c.id && (
                        <Check className="size-3.5" />
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-4 py-3 text-[10px] text-zinc-500 italic text-center leading-tight">
                    Clique no workspace para ver suas colunas
                  </div>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
