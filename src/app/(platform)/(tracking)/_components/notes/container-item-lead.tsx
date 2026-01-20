"use client";

import { useState } from "react";
import {
  CalendarFoldIcon,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { SubSectionAttendance } from "./sub-section-attendance";
import { SubSectionRemimber } from "./sub-section-remimber";
import { SubSectionDuration } from "./sub-section-duration";
import { TypeAction } from "@/generated/prisma/enums";
import { ICONS } from "./types";
import { format } from "date-fns";

interface Responsable {
  id: string;
  name: string;
  profile: string | null;
  email: string;
}

interface ComtainerItemLeadProps {
  id: string;
  title: string;
  description: string | null;
  score: number;
  isDone: boolean;
  trackingId: string | null;
  organizationId: string | null;
  createdBy: string;
  leadId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  responsibles: Responsable[];
  type: TypeAction;
  createdAt: Date;
}

export function ContainerItemLead({
  type,
  responsibles,
  description,
  title,
  createdAt,
}: ComtainerItemLeadProps) {
  const [toggleDetails, setToggleDetails] = useState(true);

  function handleToggleDetails() {
    setToggleDetails((current) => !current);
  }

  return (
    <div className="rounded-md bg-accent-foreground/5">
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3 ">
          <Button
            variant="ghost"
            size="icon-xs"
            className="mr-1"
            onClick={handleToggleDetails}
          >
            {toggleDetails ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
          <div className={`p-1 rounded-sm ${ICONS[type].bgIcon}`}>
            {ICONS[type].Icon}
          </div>
          <span className="text-sm">
            <span className="font-medium">{ICONS[type].title}</span> Criado por
            <span className="font-medium"> John Marson</span>
          </span>
        </div>
        <div className="flex fle-row items-center gap-3 ">
          <div className="hidden md:flex fle-row items-center gap-3 ">
            <CalendarFoldIcon className="size-4" />
            <span className="text-sm truncate line-clamp-1">
              {format(new Date(createdAt), "dd/MM/yyyy")}
            </span>
          </div>
          <Button variant="ghost" size="icon-xs" className="mr-1">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      <Separator className="w-full" />
      <CardDetails type={type} {...{ description, title }} />
    </div>
  );
}

interface CardDetailsProps {
  type: TypeAction;
  image?: string;
  description: string | null;
  title: string;
}

function CardDetails({ type, image, description, title }: CardDetailsProps) {
  return (
    <div className="flex flex-col p-8 gap-4">
      <div className=" flex flex-row">
        <div className="flex flex-col gap-2">
          <span className="font-medium">{title}</span>
          <span className="text-sm font-mono text-accent-foreground/60">
            {description}
          </span>
        </div>
        {image && <img src={image} className="w-full" />}
      </div>
      <div
        className="hidden border border-accent/40 p-4 rounded-sm
      sm:flex sm:flex-row sm:gap-0 sm:justify-between"
      >
        {type === "TASK" && <SectionTask />}
        {type === "MEETING" && <SectionMeeting />}
      </div>
    </div>
  );
}

function SubSectionPriority() {
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
function SubSectionAssigned() {
  const [assignedSelected, setAssignedSelected] = useState("John");

  const userSelectable = [
    { name: "Chiquinho" },
    { name: "John" },
    { name: "Pedrin" },
  ];

  return (
    <div>
      <div className="space-y-2">
        <Label className="opacity-80 font-normal text-xs">Responsável</Label>

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
              {userSelectable.map((item) => (
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

function SectionTask() {
  return (
    <div className="flex flex-row justify-between w-full">
      <SubSectionRemimber />
      <Separator
        orientation="vertical"
        className="hidden sm:flex h-13! bg-accent/40 "
      />
      <SubSectionPriority />
      <div className="flex flex-row gap-6 ">
        <Separator
          orientation="vertical"
          className="hidden sm:flex h-13! bg-accent/40"
        />
        <SubSectionAssigned />
      </div>
      <div />
    </div>
  );
}
function SectionMeeting() {
  return (
    <div className="flex flex-row justify-between w-full">
      <SubSectionRemimber />
      <Separator
        orientation="vertical"
        className="hidden sm:flex h-13! bg-accent/40 "
      />
      <SubSectionDuration />
      <div className="flex flex-row gap-6 ">
        <Separator
          orientation="vertical"
          className="hidden sm:flex h-13! bg-accent/40"
        />
        <SubSectionAttendance />
      </div>
      <div />
    </div>
  );
}
