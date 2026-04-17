import React from "react";
import { variableCategories } from "../data/variables";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface VariableDropdownProps {
  search: string;
  onSelect: (value: string) => void;
}

export function VariableDropdown({ search, onSelect }: VariableDropdownProps) {
  const lower = search.toLowerCase();

  const filtered = variableCategories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          lower === "" ||
          item.label.toLowerCase().includes(lower) ||
          item.value.toLowerCase().includes(lower),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <DropdownMenu open={true} modal={false}>
      <DropdownMenuTrigger className="opacity-0 w-0 h-0 p-0 m-0 border-0 absolute -top-8" />
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={0}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-72 bg-zinc-900 border-zinc-700/60 p-0 shadow-2xl max-h-64 overflow-y-auto"
      >
        <DropdownMenuLabel className="px-3 py-2 border-b border-zinc-800 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Variáveis
        </DropdownMenuLabel>

        {filtered.map((cat) => (
          <DropdownMenuGroup key={cat.label}>
            <div className="px-3 py-1.5 flex items-center gap-1.5 opacity-80 pointer-events-none">
              <span className="text-xs">{cat.emoji}</span>
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {cat.label}
              </span>
            </div>
            {cat.items.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onClick={() => onSelect(item.value)}
                className="w-full flex-col items-start px-4 py-2 cursor-pointer focus:bg-zinc-800 transition-colors"
              >
                <span className="block text-sm text-purple-300 font-mono">
                  {item.label}
                </span>
                {item.description && (
                  <span className="block text-[10px] text-zinc-600 mt-0.5 whitespace-normal leading-tight">
                    {item.description}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}

        {filtered.length === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-600 outline-none">
            Nenhuma variável encontrada.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
