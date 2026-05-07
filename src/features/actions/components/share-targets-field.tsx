"use client";

import { Building2Icon, CheckIcon, LockIcon, XIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useShareableOrgs } from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";

type Org = {
  id: string;
  name: string;
  logo: string | null;
  role: string;
  canShareDirectly: boolean;
};

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/**
 * Multi-select de empresas para compartilhar a action sendo criada.
 *
 * - Itens com `canShareDirectly` são copiados direto na criação.
 * - Itens sem permissão direta entram como `ActionShare` PENDING (botão
 *   "Solicitar acesso" muda apenas a label/badge, mas o user pode
 *   selecionar normalmente — o backend trata o fluxo).
 */
export function ShareTargetsField({ value, onChange, disabled }: Props) {
  const { data, isLoading } = useShareableOrgs();
  const orgs: Org[] = (data?.organizations ?? []) as Org[];

  if (!isLoading && orgs.length === 0) {
    // Sem empresas vinculadas — escondemos o campo pra não poluir o modal.
    return null;
  }

  const toggle = (orgId: string) => {
    if (value.includes(orgId)) {
      onChange(value.filter((id) => id !== orgId));
    } else {
      onChange([...value, orgId]);
    }
  };

  const selectedOrgs = orgs.filter((o) => value.includes(o.id));

  return (
    <div className="space-y-2">
      {selectedOrgs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOrgs.map((o) => (
            <div
              key={o.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5",
                o.canShareDirectly
                  ? "border-emerald-300/60 bg-emerald-500/10"
                  : "border-amber-300/60 bg-amber-500/10",
              )}
            >
              <Avatar className="size-5">
                <AvatarImage src={o.logo ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {o.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{o.name}</span>
              {!o.canShareDirectly && (
                <LockIcon className="size-3 text-amber-600 dark:text-amber-400" />
              )}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                disabled={disabled}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 font-normal"
            disabled={disabled}
          >
            <Building2Icon className="size-3.5" />
            <span className="text-muted-foreground">
              {value.length === 0
                ? "Escolher empresas (opcional)"
                : `${value.length} empresa${value.length > 1 ? "s" : ""} selecionada${value.length > 1 ? "s" : ""}`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Buscar empresa..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Carregando..." : "Nenhuma empresa encontrada."}
              </CommandEmpty>
              <CommandGroup>
                {orgs.map((o) => {
                  const checked = value.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.name}
                      onSelect={() => toggle(o.id)}
                      className="flex items-center gap-2"
                    >
                      <Avatar className="size-5">
                        <AvatarImage src={o.logo ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {o.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{o.name}</span>
                        <span
                          className={cn(
                            "truncate text-[10px]",
                            o.canShareDirectly
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {o.canShareDirectly
                            ? `✓ ${o.role} — permissão direta`
                            : "🔒 Solicitar acesso ao master"}
                        </span>
                      </div>
                      {checked && (
                        <CheckIcon className="size-3.5 shrink-0 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
