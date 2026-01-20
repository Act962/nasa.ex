import { useState } from "react";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SubSectionAttendance() {
  const [assignedSelected, setAssignedSelected] = useState("30min");

  const userAttendance = ["Chiquinho", "John", "Pedrin"];

  return (
    <div>
      <div className="space-y-2 ">
        <Label className="opacity-80 font-normal text-xs">Atendente</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="text-sm">
              <Avatar className="size-4">
                <AvatarImage src={"https://github.com/elfabrica.png"} />
              </Avatar>
              {assignedSelected || "Selecionar"}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-54">
            <DropdownMenuRadioGroup
              value={assignedSelected}
              onValueChange={setAssignedSelected}
            >
              {userAttendance.map((item) => (
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
