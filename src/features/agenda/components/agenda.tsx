"use client";

import { EntityHeader } from "@/components/entity-components";
import {
  useDeleteAgenda,
  useDuplicateAgenda,
  useSuspenseAgendas,
} from "../hooks/use-agenda";
import { useState } from "react";
import { CreateAgendaModal } from "./create-agenda-modal";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  ArrowUpRight,
  CopyIcon,
  EditIcon,
  EllipsisIcon,
  LinkIcon,
  TrashIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DeleteAgendaModal } from "./delete-agenda-modal";

export const AgendaList = () => {
  const [openDelete, setOpenDelete] = useState(false);
  const [agendaId, setAgendaId] = useState<string | null>(null);

  const { data } = useSuspenseAgendas();
  const duplicateAgenda = useDuplicateAgenda();
  const deleteAgenda = useDeleteAgenda();

  const baseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/agenda/${data?.organization?.slug}`;

  const handleCopyLink = (agendaId: string) => {
    navigator.clipboard.writeText(`${baseUrl}/${agendaId}`);
    toast.success("Link copiado para a área de transferência", {
      position: "bottom-center",
    });
  };

  const handleDuplicateAgenda = (agendaId: string) => {
    duplicateAgenda.mutate({ agendaId });
  };

  const handleDeleteAgenda = (agendaId: string) => {
    deleteAgenda.mutate({ agendaId });
    setOpenDelete(false);
  };

  return (
    <>
      <div className="space-y-4">
        {data.agendas.map((agenda) => {
          return (
            <Item variant="outline" key={agenda.id} asChild>
              <Link href={`/agenda/${agenda.id}`}>
                <ItemContent>
                  <ItemTitle>{agenda.name}</ItemTitle>
                  <ItemDescription>{agenda.description}</ItemDescription>
                </ItemContent>
                <ItemActions
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <div className="flex gap-2 items-center">
                    <Switch />

                    <ButtonGroup>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`${baseUrl}/${agenda.id}`, "_blank")
                        }
                      >
                        <ArrowUpRight />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(agenda.id)}
                      >
                        <LinkIcon />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <EllipsisIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/agendas/${agenda.id}`}>
                              <EditIcon /> Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleDuplicateAgenda(agenda.id)}
                          >
                            <CopyIcon /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => {
                              setAgendaId(agenda.id);
                              setOpenDelete(true);
                            }}
                          >
                            <TrashIcon /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ButtonGroup>
                  </div>
                </ItemActions>
              </Link>
            </Item>
          );
        })}
      </div>

      {openDelete && agendaId && (
        <DeleteAgendaModal
          open={openDelete}
          onOpenChange={setOpenDelete}
          onDelete={handleDeleteAgenda}
          agendaId={agendaId}
        />
      )}
    </>
  );
};

export const AgendaHeader = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EntityHeader
        title="Agenda"
        description="Gerencie seus compromissos"
        newButtonLabel="Novo compromisso"
        onNew={() => setOpen(true)}
      />

      <CreateAgendaModal open={open} onOpenChange={setOpen} />
    </>
  );
};

export const AgendaContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="h-full w-full px-8 py-6 space-y-6">
      <AgendaHeader />
      {children}
    </div>
  );
};
