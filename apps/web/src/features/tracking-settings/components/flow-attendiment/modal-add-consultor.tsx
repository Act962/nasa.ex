"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { CheckIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateTrackingConsultant,
  useQueryUsersWithoutConsultants,
} from "../../hooks/use-tracking-consultants";

interface ModalAddConsultorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
}

export function ModalAddConsultor({
  isOpen,
  onOpenChange,
  trackingId,
}: ModalAddConsultorProps) {
  const [selectedUser, setSelectedUser] = useState<string[]>([]);
  const { isLoadingUsersWithoutConsultants, usersWithoutConsultants: data } =
    useQueryUsersWithoutConsultants(trackingId);
  const mutation = useCreateTrackingConsultant();
  const [name, setName] = useState("");

  const filteredParticipants = data?.filter((participant) =>
    participant.user.name.toLowerCase().includes(name.toLowerCase()),
  );

  const toggleSelectUser = (userId: string) => {
    setSelectedUser((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    mutation.mutate(
      {
        trackingId,
        userIds: selectedUser,
      },
      {
        onSuccess: () => {
          toast("Consultor adicionado com sucesso!");
          setSelectedUser([]);
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erro ao adicionar consultor.");
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Atendente</DialogTitle>
          <DialogDescription>
            Adicione novos atendentes ao seu fluxo de atendimento.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <Label htmlFor="name-1">Name</Label>
            <Input
              onChange={(e) => setName(e.target.value)}
              value={name}
              id="name-1"
              name="name"
            />
          </Field>
          <ScrollArea className="h-75 pr-4">
            <div className="space-y-2">
              {!isLoadingUsersWithoutConsultants &&
                data &&
                filteredParticipants?.map((trackingParticipant) => (
                  <button
                    disabled={mutation.isPending}
                    type="button"
                    key={trackingParticipant.id}
                    onClick={() =>
                      toggleSelectUser(trackingParticipant.user.id)
                    }
                    className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex flex-col">
                          <span className="font-medium line-clamp-1">
                            {trackingParticipant.user.name}
                          </span>
                          <span className="font-light text-xs text-muted-foreground line-clamp-1">
                            {trackingParticipant.user.email}
                          </span>
                        </div>
                        {selectedUser?.includes(
                          trackingParticipant.user.id,
                        ) && (
                          <CheckIcon className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              {!isLoadingUsersWithoutConsultants &&
                filteredParticipants?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <UserIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      Nenhum lead encontrado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tente buscar por outro lead
                    </p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
