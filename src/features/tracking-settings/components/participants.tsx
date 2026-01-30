"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, Plus, Search, Trash2, User } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function Participants() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [member, setMember] = useState<{ id: string; name: string } | null>(
    null
  );
  const params = useParams<{ trackingId: string }>();

  const { data, isPending } = useSuspenseQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: { trackingId: params.trackingId },
    })
  );

  const currentUser = data.participants.find(
    (participant) => participant.userId === session?.user.id
  );

  const participantsIds = data.participants.map(
    (participant) => participant.userId
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Participantes</h2>
            <p className="text-muted-foreground text-sm">
              Lista de participantes
            </p>
          </div>
          <Button
            disabled={currentUser?.role !== "OWNER"}
            onClick={() => setOpen(true)}
          >
            <Plus />
            Adicionar
          </Button>
        </div>

        <div>
          {isPending &&
            Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}

          {!isPending &&
            data.participants.length > 0 &&
            data.participants.map((participant) => (
              <Item key={participant.id}>
                <ItemMedia>
                  <Avatar className="size-10">
                    <AvatarImage src={participant.user.image || undefined} />
                    <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{participant.user.name}</ItemTitle>
                  <ItemDescription>{participant.user.email}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {currentUser?.role !== "MEMBER" && (
                    <Button
                      variant="ghost"
                      disabled={
                        participant.role === "OWNER" ||
                        session?.user.id === participant.userId
                      }
                      onClick={() => {
                        setMember(participant.user);
                        setRemoveOpen(true);
                      }}
                    >
                      <Trash2 />
                      Remover
                    </Button>
                  )}
                </ItemActions>
              </Item>
            ))}
        </div>
      </div>

      <AddParticipantDialog
        open={open}
        onOpenChange={setOpen}
        participantsIds={participantsIds}
      />

      <RemoveParticipantDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        member={member}
      />
    </>
  );
}

interface AddParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantsIds: string[];
}

interface Member {
  id: string;
  email: string;
  name: string;
  image?: string | undefined;
}

function AddParticipantDialog({
  open,
  onOpenChange,
  participantsIds,
}: AddParticipantDialogProps) {
  const params = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();
  const { data: organization } = authClient.useActiveOrganization();
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<string[]>([]);

  const addParticipants = useMutation(
    orpc.tracking.addParticipant.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.listParticipants.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });

        onOpenChange(false);
        toast.success("Participante adicionado com sucesso");
      },
      onError: () => {
        toast.error("Erro ao adicionar participante");
      },
    })
  );

  const members =
    organization?.members.filter(
      (member) => !participantsIds.includes(member.userId)
    ) || [];

  const filteredMembers = members.filter((member) => {
    return member.user.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelectMember = (member: Member) => {
    if (selectedMember.includes(member.id)) {
      setSelectedMember((prev) => prev.filter((id) => id !== member.id));
    } else {
      setSelectedMember((prev) => [...prev, member.id]);
    }
  };

  const onSubmit = () => {
    addParticipants.mutate({
      participantIds: selectedMember,
      trackingId: params.trackingId,
      role: "MEMBER",
    });
  };

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedMember([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar participante</DialogTitle>
          <DialogDescription>
            Adicione um membro ao seu time para que ele possa participar do seu
            tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              placeholder="Procurar membro"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>

          <div className="space-y-2">
            {filteredMembers?.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <User />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum membro</EmptyTitle>
                  <EmptyDescription>
                    Nenhum membro encontrado para adicionar ao seu tracking.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {filteredMembers?.length > 0 &&
              filteredMembers?.map((member) => (
                <Item
                  key={member.id}
                  variant={
                    selectedMember.includes(member.user.id)
                      ? "muted"
                      : "default"
                  }
                  onClick={() => {
                    handleSelectMember(member.user);
                  }}
                  className="cursor-pointer"
                >
                  <ItemMedia>
                    <Avatar className="size-10">
                      <AvatarImage src={member.user.image || undefined} />
                      <AvatarFallback>{member.user.name[0]}</AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{member.user.name}</ItemTitle>
                    <ItemDescription>{member.user.email}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {selectedMember.includes(member.user.id) && <Check />}
                  </ItemActions>
                </Item>
              ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            disabled={addParticipants.isPending || selectedMember.length === 0}
            onClick={onSubmit}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RemoveParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: { id: string; name: string } | null;
}

function RemoveParticipantDialog({
  open,
  onOpenChange,
  member,
}: RemoveParticipantDialogProps) {
  const queryClient = useQueryClient();
  const params = useParams<{ trackingId: string }>();

  const removeParticipant = useMutation(
    orpc.tracking.removeParticipant.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.listParticipants.queryKey({
            input: {
              trackingId: params.trackingId,
            },
          }),
        });
        toast.success("Participante removido com sucesso");
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Erro ao remover participante");
      },
    })
  );

  const onSubmit = () => {
    if (!member) return;
    removeParticipant.mutate({
      trackingId: params.trackingId,
      participantId: member.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover membro</DialogTitle>
          <DialogDescription>
            Deseja realmente remover o membro <strong>{member?.name}</strong> do
            seu tracking?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
