"use client";

import { ButtonGroup } from "@/components/ui/button-group";
import {
  useDeleteAgenda,
  useSuspenseAgenda,
  useToggleActiveAgenda,
} from "../hooks/use-agenda";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  LinkIcon,
  TrashIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeleteAgendaModal } from "./delete-agenda-modal";
import Link from "next/link";

interface HeaderAgendaProps {
  agendaId: string;
}

export function HeaderAgenda({ agendaId }: HeaderAgendaProps) {
  const router = useRouter();
  const [openDelete, setOpenDelete] = useState(false);
  const { data } = useSuspenseAgenda(agendaId);

  const baseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/agenda/${data?.agenda.organization.slug}/${data?.agenda.slug}`;

  const [isActive, setIsActive] = useState(data.agenda.isActive);

  const toggleActiveAgenda = useToggleActiveAgenda();
  const deleteAgenda = useDeleteAgenda();

  const handleToggleActiveAgenda = (checked: boolean) => {
    toggleActiveAgenda.mutate({
      agendaId,
      isActive: checked,
    });
    setIsActive(checked);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(baseUrl);
    toast.success("Link copiado para a área de transferência", {
      position: "bottom-center",
    });
  };

  const handleDeleteAgenda = (agendaId: string) => {
    deleteAgenda.mutate(
      { agendaId },
      {
        onSuccess: () => {
          router.push("/agendas");
        },
      },
    );
    setOpenDelete(false);
  };

  return (
    <>
      <div className="sticky h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="ghost" asChild>
            <Link href="/agendas">
              <ArrowLeftIcon />
            </Link>
          </Button>

          {data.agenda.name}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={handleToggleActiveAgenda}
          />

          <Separator orientation="vertical" className="w-px! h-5!" />

          <ButtonGroup>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(baseUrl, "_blank")}
            >
              <ArrowUpRightIcon />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyLink}>
              <LinkIcon />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenDelete(true)}
            >
              <TrashIcon />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <DeleteAgendaModal
        open={openDelete}
        onOpenChange={setOpenDelete}
        agendaId={agendaId}
        onDelete={handleDeleteAgenda}
      />
    </>
  );
}
