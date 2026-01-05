import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, UserIcon, UserRound, UsersIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";

interface Participant {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export function ParticipantsSwitcher() {
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

  const [participantFilter, setParticipantFilter] =
    useQueryState("participant");

  const handleParticipantFilter = (participant: Participant | null) => {
    setSelectedParticipant(participant);
    setParticipantFilter(participant?.user.email || "");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selectedParticipant ? (
            <>
              <Avatar className="size-5">
                <AvatarImage src={selectedParticipant.user.image || ""} />
                <AvatarFallback>
                  {selectedParticipant.user.name[0]}
                </AvatarFallback>
              </Avatar>
              {selectedParticipant.user.name}
            </>
          ) : (
            <>
              <UsersIcon className="size-4" />
              Participantes
            </>
          )}
          <ChevronsUpDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Participantes</DropdownMenuLabel>
        {isPending && <DropdownMenuLabel>Carregando...</DropdownMenuLabel>}
        {!isPending && (
          <>
            <DropdownMenuItem
              key="all"
              className="cursor-pointer"
              onClick={() => setSelectedParticipant(null)}
            >
              <UserRound className="size-5 border rounded-full" />
              Nenhum
            </DropdownMenuItem>
            {data?.participants.map((participant) => (
              <DropdownMenuItem
                key={participant.id}
                className="cursor-pointer"
                onClick={() => handleParticipantFilter(participant)}
              >
                <Avatar className="size-5">
                  <AvatarImage
                    src={participant?.user?.image || ""}
                    alt={participant.user.name}
                  />
                  <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
                </Avatar>
                {participant.user.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
