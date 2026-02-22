"use client";

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
import { ChevronsUpDown, UserRound, UsersIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useMemo } from "react";

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

  // Query com staleTime para evitar refetch desnecessário
  const { data, isPending } = useQuery({
    ...orpc.tracking.listParticipants.queryOptions({
      input: {
        trackingId: params.trackingId,
      },
    }),
  });

  const [participantFilter, setParticipantFilter] =
    useQueryState("participant");

  // Memoize o participante selecionado baseado na URL
  const selectedParticipant = useMemo(() => {
    if (!participantFilter || !data?.participants) return null;

    return (
      data.participants.find((p) => p.user.email === participantFilter) || null
    );
  }, [participantFilter, data?.participants]);

  // Handler otimizado que não causa re-render
  const handleParticipantFilter = (participant: Participant | null) => {
    setParticipantFilter(participant?.user.email || null);
  };

  // Handler para limpar filtro
  const handleClearFilter = () => {
    setParticipantFilter(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {selectedParticipant ? (
            <>
              <Avatar className="size-5">
                <AvatarImage
                  src={selectedParticipant.user.image || ""}
                  alt={selectedParticipant.user.name}
                />
                <AvatarFallback>
                  {selectedParticipant.user.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-30 truncate">
                {selectedParticipant.user.name}
              </span>
            </>
          ) : (
            <>
              <UsersIcon className="size-4" />
              Participantes
            </>
          )}
          <ChevronsUpDown className="size-3 ml-auto opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Participantes</DropdownMenuLabel>

        {isPending ? (
          <DropdownMenuLabel className="text-sm font-normal text-muted-foreground">
            Carregando...
          </DropdownMenuLabel>
        ) : (
          <>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={handleClearFilter}
              disabled={!selectedParticipant}
            >
              <UserRound className="size-5 border rounded-full p-0.5" />
              <span>Todos os participantes</span>
            </DropdownMenuItem>

            {data?.participants.map((participant) => {
              const isSelected =
                selectedParticipant?.user.email === participant.user.email;

              return (
                <DropdownMenuItem
                  key={participant.id}
                  className="cursor-pointer gap-2"
                  onClick={() => handleParticipantFilter(participant)}
                  disabled={isSelected}
                >
                  <Avatar className="size-5">
                    <AvatarImage
                      src={participant.user.image || ""}
                      alt={participant.user.name}
                    />
                    <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">
                    {participant.user.name}
                  </span>
                  {isSelected && (
                    <div className="size-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
