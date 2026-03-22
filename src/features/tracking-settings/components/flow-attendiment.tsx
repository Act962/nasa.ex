"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowUpRightIcon,
  BriefcaseIcon,
  CheckIcon,
  GitPullRequestArrowIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import {
  useCreateTrackingConsultant,
  useDeleteTrackingConsultant,
  useQueryTrackingConsultants,
  useQueryUsersWithoutConsultants,
  useUpdateTrackingConsultant,
} from "../hooks/use-tracking-consultants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch-variable";

interface FlowAttendimentProps {
  trackingId: string;
}
export function FlowAttendiment({ trackingId }: FlowAttendimentProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { isLoadingTrackingConsultants, trackingConsultants } =
    useQueryTrackingConsultants(trackingId);

  return (
    <>
      <div className="flex w-full flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1 w-full">
          <div className="flex justify-between w-full gap-2">
            <div className="flex items-center gap-2">
              <GitPullRequestArrowIcon className="size-4 " />
              <h2 className="text-xl font-semibold">Fluxo de atendimento</h2>
            </div>
            <Button onClick={() => setModalOpen(true)}>
              Adicionar Consultor
            </Button>
          </div>
          <span>Consultores</span>

          {!isLoadingTrackingConsultants &&
            trackingConsultants?.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum atendente encontrado</EmptyTitle>
                  <EmptyDescription>
                    Adicione atendentes para seu atendimento ter mais dinamismo.
                  </EmptyDescription>
                </EmptyHeader>

                <Button size="sm" onClick={() => setModalOpen(true)}>
                  Adicionar consultor <ArrowUpRightIcon />
                </Button>
              </Empty>
            )}
          <div className="h-full overflow-y-auto mt-4 space-y-3">
            {!isLoadingTrackingConsultants &&
              trackingConsultants &&
              trackingConsultants.map((consultant) => (
                <ItemConsultor
                  key={consultant.user.id}
                  consultant={{ ...consultant.user }}
                  maxFlow={consultant.maxFlow}
                  currentFlow={consultant.currentFlow}
                  trackingId={consultant.trackingId}
                  consultantId={consultant.id}
                  isActive={consultant.isActive}
                />
              ))}
          </div>
        </div>
      </div>
      <ModalAddConsultor
        trackingId={trackingId}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}

interface ItemConsultorProps {
  consultant: {
    name: string;
    image: string | null;
  };
  maxFlow: number;
  currentFlow: number;
  trackingId: string;
  isActive: boolean;
  consultantId: string;
}
function ItemConsultor({
  currentFlow,
  maxFlow,
  consultant,
  trackingId,
  isActive,
  consultantId,
}: ItemConsultorProps) {
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const mutation = useUpdateTrackingConsultant();
  const [isEditing, setIsEditing] = useState(false);
  const [flowValue, setFlowValue] = useState(maxFlow);

  const toggleActive = () => {
    mutation.mutate({
      id: consultantId,
      isActive: !isActive,
    });
  };

  const onchangeFlowValue = (value: number) => {
    mutation.mutate(
      {
        id: consultantId,
        maxFlow: value,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
        onError: (error: any) => {
          toast.error("Erro ao atualizar fluxo do consultor.");
          setFlowValue(maxFlow);
        },
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={consultant.image || undefined} />
              <AvatarFallback>
                {consultant.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <span>{consultant.name}</span>
          </CardTitle>
          <CardAction className="space-x-3">
            <Switch checked={isActive} onCheckedChange={toggleActive} />
            <Button
              size={"icon-sm"}
              onClick={() => setModalDeleteOpen(true)}
              variant={"destructive"}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Total atendido por vez:</span>

              {isEditing ? (
                <input
                  disabled={mutation.isPending}
                  type="number"
                  value={flowValue}
                  onChange={(e) => setFlowValue(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onchangeFlowValue(flowValue);
                    }
                  }}
                  className="w-16 px-2 py-1 border rounded text-sm"
                  autoFocus
                />
              ) : (
                <>
                  <span>{flowValue}</span>
                  <Button
                    onClick={() => setIsEditing(true)}
                    size={"icon-xs"}
                    variant={"ghost"}
                  >
                    <PencilIcon className="size-3" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-x-2">
              <span>Atendendo agora: {currentFlow}</span>
              <ArrowUpRightIcon className="size-3" />
            </div>
          </div>
        </CardContent>
      </Card>
      <ModalDeleteConsultor
        isOpen={modalDeleteOpen}
        onOpenChange={setModalDeleteOpen}
        consultant={{ ...consultant, id: consultantId }}
        trackingId={trackingId}
      />
    </>
  );
}

interface ModalAddConsultorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
}

function ModalAddConsultor({
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
        userId: selectedUser[0],
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

function ModalDeleteConsultor({
  isOpen,
  onOpenChange,
  consultant,
  trackingId,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  consultant: {
    id: string;
    name: string;
  };
  trackingId: string;
}) {
  const [confirmName, setConfirmName] = useState("");
  const mutation = useDeleteTrackingConsultant(trackingId);
  const [isWrong, setIsWrong] = useState(false);

  const isNameValid =
    confirmName.trim().toLowerCase() === consultant.name.trim().toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isNameValid) {
      setIsWrong(true);
      return;
    }

    mutation.mutate(
      {
        id: consultant.id,
      },
      {
        onSuccess: () => {
          toast("Consultor removido com sucesso!");
          setConfirmName("");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erro ao remover consultor.");
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remover Consultor</DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. Para confirmar, digite{" "}
            <span className="text-foreground">{consultant.name} </span>
            abaixo.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <Label htmlFor="confirm-name">Nome do consultor</Label>
            <Input
              id="confirm-name"
              name="confirmName"
              placeholder={consultant.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </Field>

          {isWrong && (
            <p className="text-xs text-red-500">
              O nome digitado não corresponde.
            </p>
          )}
        </FieldGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>

          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner /> : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
