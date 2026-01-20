"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SubSectionDuration() {
  const [assignedSelected, setAssignedSelected] = useState("30min");

  const timesToSelect = ["30min", "1h", "1:30h", "2h", "2:30h", "3h"];

  return (
    <div>
      <div className="space-y-2 ">
        <Label className="opacity-80 font-normal text-xs">Duração</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="text-sm">
              {assignedSelected || "Selecionar"}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-54">
            <DropdownMenuRadioGroup
              value={assignedSelected}
              onValueChange={setAssignedSelected}
            >
              {timesToSelect.map((item) => (
                <DropdownMenuRadioItem
                  key={`item-${item}`}
                  value={item}
                  id={item}
                >
                  {item}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
