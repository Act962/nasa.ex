"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import dayjs from "dayjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "dayjs/locale/pt-br";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Folder, MoreVertical, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTracking } from "@/hooks/use-tracking-modal";
import { PatternsSection } from "@/features/admin/components/patterns-section";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
dayjs.extend(utc);
dayjs.extend(relativeTime);

dayjs.locale("pt-BR");

function TrackingCard({ tracking }: { tracking: typeof trackings[0] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteTracking = useMutation(
    orpc.tracking.delete.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });
        toast.success(`${data.trackingName} arquivado por 30 dias antes da exclusão permanente`);
        setShowDeleteConfirm(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  return (
    <>
      <Link href={`/tracking/${tracking.id}`}>
        <Card className="cursor-pointer h-full transition-colors hover:bg-accent/60 relative">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle>{tracking.name}</CardTitle>
                <CardDescription>
                  {tracking.description ? tracking.description : "Sem descrição"}
                </CardDescription>
              </div>
              <div onClick={(e) => e.preventDefault()}>
                <DropdownMenu open={open} onOpenChange={setOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setOpen(false);
                      }}
                      disabled={deleteTracking.isPending}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-end">
              <span className="text-sm text-muted-foreground">
                Criado {dayjs(tracking.createdAt).fromNow()}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar tracking?</AlertDialogTitle>
            <AlertDialogDescription>
              O tracking "{tracking.name}" será arquivado por 30 dias. Durante este período, você poderá recuperá-lo. Após 30 dias, será deletado permanentemente. Esta ação pode ser rastreada em Configurações &gt; Histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleteTracking.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTracking.mutate({ trackingId: tracking.id })}
              disabled={deleteTracking.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteTracking.isPending ? "Arquivando..." : "Deletar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TrackingList() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";
  const { onOpen } = useTracking();

  const { data: trackings, isLoading } = useSuspenseQuery(
    orpc.tracking.list.queryOptions()
  );

  const trackingList = query
    ? trackings.filter((tracking) =>
        tracking.name.toLowerCase().includes(query.toLowerCase())
      )
    : trackings;

  const hasPosts = trackingList.length > 0;

  return (
    <div className="mt-8">
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-full" />
          ))}
        </div>
      )}
      {hasPosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {trackingList.map((tracking) => (
            <TrackingCard key={tracking.id} tracking={tracking} />
          ))}
        </div>
      )}
      {!hasPosts && !isLoading && (
        <div className="flex items-center justify-center mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Folder />
              </EmptyMedia>
              <EmptyTitle>Nenhum tracking encontrado</EmptyTitle>
              <EmptyDescription>
                Você não possui nenhum trackings criado ainda. Começe criando
                seu primeiro tracking
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button onClick={onOpen}>Criar novo tracking</Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
      <PatternsSection
        appType="tracking"
        redirectPath={(id) => `/tracking/${id}`}
      />
    </div>
  );
}
