"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTracking } from "@/features/trackings/hooks/use-trackings";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface TrackingDangerZoneProps {
  trackingId: string;
}

export function TrackingDangerZone({ trackingId }: TrackingDangerZoneProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTracking = useDeleteTracking();
  const [role, setRole] = useState<
    "owner" | "admin" | "moderador" | "member" | null
  >(null);

  const handleConfirm = () => {
    deleteTracking.mutate(
      { trackingId },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          router.push("/tracking");
        },
      },
    );
  };

  useEffect(() => {
    const fetchRole = async () => {
      const { data } = await authClient.organization.getActiveMemberRole();

      if (data) {
        setRole(data.role);
      }
    };

    fetchRole();
  }, []);

  const canDelete = ["owner", "admin", "moderador"].includes(role || "");

  return (
    <>
      <div className="max-w-2xl space-y-6">
        <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
          <div>
            <h3 className="text-lg font-medium text-destructive">
              Deletar Tracking
            </h3>
            <p className="text-sm text-muted-foreground">
              Uma vez deletado, o tracking será arquivado por 30 dias antes da
              exclusão permanente. Durante este período, você poderá
              recuperá-lo. Esta ação pode ser rastreada em Configurações &gt;
              Histórico.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteTracking.isPending || !canDelete}
            className="w-full sm:w-auto gap-2"
          >
            <Trash2 className="size-4" />
            {deleteTracking.isPending ? "Deletando..." : "Deletar"}
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar tracking?</AlertDialogTitle>
            <AlertDialogDescription>
              O tracking será arquivado por 30 dias. Você poderá recuperá-lo
              durante este período. Após 30 dias, será deletado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleteTracking.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={deleteTracking.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteTracking.isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
