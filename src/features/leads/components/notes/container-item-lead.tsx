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
import {
  SubSectionAssigned,
  SubSectionAttendance,
  SubSectionPriority,
} from "./sub-sections";
import { SubSectionRemimber } from "./sub-sections";
import { SubSectionDuration } from "./sub-sections";
import { TypeAction } from "@/generated/prisma/enums";
import { ICONS } from "./types";
import { format } from "date-fns";
import { SafeContent } from "@/components/rich-text-editor/safe-content";
import { useListTrackingParticipants } from "@/features/users/use-list-tracking-participants";
import { useMutationUpdateLeadAction } from "@/features/leads/hooks/use-lead-action";
import { Input } from "@/components/ui/input";
import { RichtTextEditor } from "@/components/rich-text-editor/editor";

export interface User {
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
  trackingId: string;
  organizationId: string | null;
  createdBy: User;
  leadId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  responsibles: User[];
  type: TypeAction;
  createdAt: Date;
}

export function ContainerItemLead({
  id,
  type,
  responsibles,
  createdBy,
  description,
  title,
  createdAt,
  trackingId,
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
            <span className="font-medium"> {createdBy.name}</span>
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
      <CardDetails
        type={type}
        {...{ description, title, responsibles, trackingId, id }}
      />
    </div>
  );
}

interface CardDetailsProps {
  type: TypeAction;
  image?: string;
  description: string | null;
  responsibles: User[];
  title: string;
  trackingId: string;
  id: string;
}

function CardDetails({
  type,
  image,
  description,
  trackingId,
  responsibles,
  id,
}: CardDetailsProps) {
  const [isEditDescription, setIsEditDescription] = useState(false);
  const [descriptionEdit, setDescriptionEdit] = useState(description);

  const mutationUpdateLeadAction = useMutationUpdateLeadAction({
    leadId: trackingId,
  });

  const onSubmitDescription = () => {
    mutationUpdateLeadAction.mutate({
      actionId: id,
      description: descriptionEdit || undefined,
    });
    setIsEditDescription(false);
  };

  return (
    <div className="flex flex-col px-8 py-4 gap-4">
      <div className=" flex flex-row">
        <div className="flex flex-col w-full gap-2">
          {isEditDescription ? (
            <div className="">
              <RichtTextEditor
                field={descriptionEdit || undefined}
                onChange={(e) => setDescriptionEdit(e)}
              >
                <Button className="ml-auto" onClick={onSubmitDescription}>
                  Salvar
                </Button>
              </RichtTextEditor>
            </div>
          ) : (
            <span
              className="text-sm font-mono text-accent-foreground/60 cursor-pointer"
              onClick={() => setIsEditDescription(true)}
            >
              <SafeContent
                content={JSON.parse(description || "")}
                className="block text-sm max-w-none min-h-[125px] focus:outline-none p-4 prose dark:prose-invert marker:text-gray-500 prose-p:my-0 prose-hr:border-gray-400/20"
              />
            </span>
          )}
        </div>
        {image && <img src={image} className="w-full" />}
      </div>
      <div
        className="hidden border border-accent/40 p-4 rounded-sm
      sm:flex sm:flex-row sm:gap-0 sm:justify-between"
      >
        {type === "TASK" && (
          <SectionTask
            actionId={id}
            trackingId={trackingId}
            responsibles={responsibles}
          />
        )}
        {type === "MEETING" && <SectionMeeting />}
      </div>
    </div>
  );
}

interface SectionTaskProps {
  responsibles: User[];
  trackingId: string;
  actionId: string;
}
function SectionTask({ responsibles, trackingId, actionId }: SectionTaskProps) {
  const { data: userSelected } = useListTrackingParticipants(trackingId);

  const mutationUpdateLeadAction = useMutationUpdateLeadAction({
    leadId: trackingId,
  });

  const onSubmit = (assignedSelected: User) => {
    mutationUpdateLeadAction.mutate({
      responsibles: [assignedSelected?.id],
      actionId,
    });
  };

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
        <SubSectionAssigned
          onSubmitAssigned={onSubmit}
          trackingId={trackingId}
          responsibles={responsibles}
          userSelectable={
            userSelected?.participants.map((item) => ({
              ...item.user,
              profile: item.user.image,
            })) || []
          }
        />
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
