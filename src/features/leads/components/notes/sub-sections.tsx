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
import { User } from "./container-item-lead";

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

export function SubSectionRemimber() {
  const [assignedSelected, setAssignedSelected] = useState<string | undefined>(
    undefined,
  );

  const remimberStatus = ["Sim", "Não"];

  return (
    <div>
      <div className="space-y-2 ">
        <Label className="opacity-80 font-normal text-xs">Lembrete</Label>

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
              {remimberStatus.map((item) => (
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

export function SubSectionPriority() {
  const [prioritySelected, setPrioritySelected] = useState("Baixa");

  const statusPriority = [
    { name: "Baixa" },
    { name: "Mediana" },
    { name: "Alta" },
  ];

  return (
    <div>
      <div className="items-start space-y-2">
        <Label className="opacity-80 font-normal text-xs">Prioridade</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="text-sm">
              {prioritySelected || "Selecionar"}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-54">
            <DropdownMenuRadioGroup
              value={prioritySelected}
              onValueChange={setPrioritySelected}
            >
              {statusPriority.map((item) => (
                <DropdownMenuRadioItem
                  key={`item-${item.name}`}
                  value={item.name}
                  id={item.name}
                >
                  {item.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
interface SubSectionAssignedProps {
  userSelectable: User[];
  responsibles: User[];
  trackingId: string;
  onSubmitAssigned: (assignedSelected: User) => void;
}

export function SubSectionAssigned({
  userSelectable,
  responsibles,
  trackingId,
  onSubmitAssigned,
}: SubSectionAssignedProps) {
  const [assignedSelected, setAssignedSelected] = useState<User | null>(
    responsibles[0],
  );

  const onSubmit = (assignedSelected: User) => {
    onSubmitAssigned(assignedSelected);
  };

  return (
    <div>
      <div className="space-y-2">
        <Label className="opacity-80 font-normal text-xs">Responsável</Label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" className="text-sm">
              {assignedSelected ? (
                <div className="flex flex-row items-center gap-2">
                  <Avatar className="size-4">
                    <AvatarImage src={assignedSelected?.profile || ""} />
                  </Avatar>
                  <span className="text-sm">{assignedSelected?.name}</span>
                </div>
              ) : (
                "Selecionar"
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-54">
            <DropdownMenuRadioGroup
              value={assignedSelected?.id}
              onValueChange={(id) => {
                const user = userSelectable.find((item) => item.id === id);
                if (user) {
                  setAssignedSelected(user);
                  onSubmit(user);
                }
              }}
            >
              {userSelectable.map((item) => (
                <DropdownMenuRadioItem
                  key={`item-${item.name}`}
                  value={item.id}
                  id={item.name}
                >
                  {item.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
