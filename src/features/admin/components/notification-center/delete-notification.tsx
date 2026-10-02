"use client";

import { useState } from "react";
import { useDeleteNotification } from "../../hooks/use-notification";
import { Trash2 } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteNotificationProps {
  notificationId: string;
  onSuccess?: () => void;
}

export function DeleteNotification({
  notificationId,
  onSuccess,
}: DeleteNotificationProps) {
  const [open, setOpen] = useState(false);

  const deleteMut = useDeleteNotification();

  const handleDelete = () => {
    deleteMut.mutate(
      { id: notificationId },
      {
        onSuccess: () => {
          setOpen(false);
          if (onSuccess) {
            onSuccess();
          }
        },
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Notificação</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir esta notificação? Esta ação não pode
            ser desfeita e a notificação será removida para todos os usuários.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMut.isPending}
            className="bg-destructive/15 hover:bg-destructive/25 text-destructive"
          >
            {deleteMut.isPending ? (
              <>
                <OrbitaSpinner className="mr-2 h-4 w-4 " />
                Excluindo...
              </>
            ) : (
              "Confirmar Exclusão"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
