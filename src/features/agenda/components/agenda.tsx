"use client";

import { EntityHeader } from "@/components/entity-components";
import {
  useDeleteAgenda,
  useDuplicateAgenda,
  useSuspenseAgendas,
  useToggleActiveAgenda,
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
  CalendarIcon,
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export const AgendaList = () => {
  const [open, setOpen] = useState(false);
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
        {data.agendas.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma agenda ainda</EmptyTitle>
              <EmptyDescription>
                Crie uma agenda para capturar leads.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>Criar agenda</Button>
            </EmptyContent>
          </Empty>
        ) : (
          data.agendas.map((agenda) => {
            return (
              <AgendaItem
                key={agenda.id}
                agenda={agenda}
                baseUrl={baseUrl}
                handleCopyLink={handleCopyLink}
                handleDuplicateAgenda={handleDuplicateAgenda}
                setOpenDelete={setOpenDelete}
                setAgendaId={setAgendaId}
              />
            );
          })
        )}
      </div>

      {openDelete && agendaId && (
        <DeleteAgendaModal
          open={openDelete}
          onOpenChange={setOpenDelete}
          onDelete={handleDeleteAgenda}
          agendaId={agendaId}
        />
      )}

      <CreateAgendaModal open={open} onOpenChange={setOpen} />
    </>
  );
};

export function SkeletonAgendaList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-20" />
      ))}
    </div>
  );
}

interface AgendaItemProps {
  agenda: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    slug: string;
  };
  baseUrl: string;
  handleCopyLink: (agendaId: string) => void;
  handleDuplicateAgenda: (agendaId: string) => void;
  setOpenDelete: (openDelete: boolean) => void;
  setAgendaId: (agendaId: string) => void;
}

export function AgendaItem({
  agenda,
  handleCopyLink,
  handleDuplicateAgenda,
  baseUrl,
  setOpenDelete,
  setAgendaId,
}: AgendaItemProps) {
  const toggleActiveAgenda = useToggleActiveAgenda();

  const [isActive, setIsActive] = useState(agenda.isActive);

  const handleToggleActiveAgenda = (checked: boolean) => {
    toggleActiveAgenda.mutate({
      agendaId: agenda.id,
      isActive: checked,
    });
    setIsActive(checked);
  };

  return (
    <Item variant="outline" key={agenda.id} asChild>
      <Link href={`/agendas/${agenda.id}`}>
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
            <Switch
              checked={isActive}
              onCheckedChange={handleToggleActiveAgenda}
            />

            <ButtonGroup>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(`${baseUrl}/${agenda.slug}`, "_blank")
                }
              >
                <ArrowUpRight />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyLink(agenda.slug)}
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
}

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
