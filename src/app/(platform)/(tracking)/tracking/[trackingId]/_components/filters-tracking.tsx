"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAddLead } from "@/hooks/modal/use-add-lead";
import { useSearchModal } from "@/hooks/modal/use-search-modal";
import { orpc } from "@/lib/orpc";
import { DropdownMenu } from "@radix-ui/react-dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export function FiltersTracking() {
  const params = useParams<{ trackingId: string }>();
  return (
    <>
      <div className="flex justify-between items-center px-4 py-2 gap-2 border-b border-border mb-2">
        <div className="flex items-center gap-x-2">
          <TrackingSwitcher />
          <ParticipantsSwitcher />
        </div>
      </div>
    </>
  );
}

function TrackingSwitcher() {
  const params = useParams<{ trackingId: string }>();
  const { data, isPending } = useQuery(orpc.tracking.list.queryOptions());

  const curretnTracking = data?.find(
    (tracking) => tracking.id === params.trackingId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {curretnTracking?.name} <ChevronsUpDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Trackings</DropdownMenuLabel>
        {isPending && <DropdownMenuLabel>Carregando...</DropdownMenuLabel>}
        {!isPending &&
          data?.map((tracking) => (
            <DropdownMenuItem
              key={tracking.id}
              asChild
              className="cursor-pointer"
            >
              <Link href={`/tracking/${tracking.id}`} prefetch>
                {tracking.name}
                {tracking.id === params.trackingId && (
                  <CheckIcon className="ml-auto h-4 w-4" />
                )}
              </Link>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Participant {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

function ParticipantsSwitcher() {
  const params = useParams<{ trackingId: string }>();
  const { data, isPending } = useQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: {
        trackingId: params.trackingId,
      },
    })
  );

  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selectedParticipant ? (
            <>
              <Avatar className="size-6">
                <AvatarImage src={selectedParticipant.user.image || ""} />
                <AvatarFallback>
                  {selectedParticipant.user.name[0]}
                </AvatarFallback>
              </Avatar>
              {selectedParticipant.user.name}
            </>
          ) : (
            "Participantes"
          )}
          <ChevronsUpDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Participantes</DropdownMenuLabel>
        {isPending && <DropdownMenuLabel>Carregando...</DropdownMenuLabel>}
        {!isPending &&
          data?.participants.map((participant) => (
            <DropdownMenuItem
              key={participant.id}
              className="cursor-pointer"
              onClick={() => setSelectedParticipant(participant)}
            >
              <Avatar className="size-6">
                <AvatarImage src={participant?.user?.image || ""} />
                <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
              </Avatar>
              {participant.user.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
