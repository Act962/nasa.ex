"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client as orpcClient } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
  POSITIONS,
  POSITION_GROUP_LABELS,
  getPositionLabel,
} from "@/features/company/constants";

const CLEAR_CARGO_VALUE = "__clear__";
const POSITION_GROUP_ORDER = ["n1", "n2", "n3", "gestao", "operacional", "entrada"] as const;

interface MemberCargoSelectProps {
  memberId: string;
  cargo: string | null;
  canManage: boolean;
  isSelf: boolean;
  onUpdated: () => void;
  triggerClassName?: string;
}

/** Cargo hierárquico do membro: editável por quem gerencia ou pelo próprio membro. */
export function MemberCargoSelect({
  memberId,
  cargo,
  canManage,
  isSelf,
  onUpdated,
  triggerClassName,
}: MemberCargoSelectProps) {
  const canEdit = canManage || isSelf;
  const [isSaving, setIsSaving] = useState(false);
  const label = getPositionLabel(cargo);

  if (!canEdit) {
    return (
      <span className="text-sm text-muted-foreground">
        {label ?? <em className="opacity-60">não definido</em>}
      </span>
    );
  }

  const handleChange = async (value: string) => {
    const nextCargo = value === CLEAR_CARGO_VALUE ? null : value;
    setIsSaving(true);
    try {
      await orpcClient.orgs.updateMemberCargo({ memberId, cargo: nextCargo });
      onUpdated();
      toast.success("Cargo atualizado");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar cargo");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Select value={cargo ?? ""} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger className={cn("h-9 text-xs md:w-[200px]", triggerClassName)}>
        <SelectValue placeholder="Definir cargo…" />
      </SelectTrigger>
      <SelectContent>
        {POSITION_GROUP_ORDER.map((group) => {
          const groupPositions = POSITIONS.filter((position) => position.group === group);
          if (groupPositions.length === 0) return null;
          return (
            <div key={group} className="py-1">
              <div className="px-2 py-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                {POSITION_GROUP_LABELS[group]}
              </div>
              {groupPositions.map((position) => (
                <SelectItem key={position.slug} value={position.slug} className="text-xs">
                  <span className="mr-1 text-muted-foreground">N{position.level}</span>
                  {position.label}
                </SelectItem>
              ))}
            </div>
          );
        })}
        <div className="my-1 border-t" />
        <SelectItem value={CLEAR_CARGO_VALUE} className="text-xs text-muted-foreground">
          Limpar cargo
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
