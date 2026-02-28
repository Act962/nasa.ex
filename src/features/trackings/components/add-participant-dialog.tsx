"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, SearchIcon, User } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

export function AddParticipantDialog({
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
              <SearchIcon />
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