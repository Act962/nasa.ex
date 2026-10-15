"use client";

import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useCheckPermission } from "@/hooks/use-check-permission";
import { formatBrl } from "../utils/format-order";
import { useConfirmCatalogOrderPayment } from "../hooks/use-catalog-order-quote";

// Loja sem Asaas: o cliente aprovou o valor e paga por fora (PIX da loja); a equipe confirma o recebimento.
export function ConfirmPaymentCard({
  orderId,
  saleNumber,
  total,
  onConfirmed,
}: {
  orderId: string;
  saleNumber: number;
  total: number;
  onConfirmed: () => void;
}) {
  const { checkPermission } = useCheckPermission();
  const canPay = checkPermission("financeiro", "canPay");
  const confirmPayment = useConfirmCatalogOrderPayment();

  const handleConfirm = () => {
    confirmPayment.mutate(
      { orderId },
      {
        onSuccess: ({ alreadyConfirmed }) => {
          toast.success(alreadyConfirmed ? "Esse pagamento já estava confirmado." : "Pagamento confirmado. O pedido seguiu para a conferência.");
          onConfirmed();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="text-sm font-semibold">Aguardando pagamento</p>
        <p className="text-xs text-muted-foreground">
          O cliente aprovou {formatBrl(total)}. Quando o PIX ou a transferência cair na conta da loja, confirme aqui: o
          pedido segue para a conferência do financeiro e da logística, como no pagamento pelo Asaas.
        </p>
      </div>
      {canPay ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="gap-1.5" disabled={confirmPayment.isPending}>
              <CheckCircle2 className="size-4" />
              Confirmar pagamento recebido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar o pagamento do pedido #{saleNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                Confira na conta da loja que {formatBrl(total)} entrou. O cliente recebe a confirmação no WhatsApp e o
                pedido segue para a separação. Não dá para desfazer por aqui.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <p className="text-xs text-muted-foreground">
          Só quem pode marcar pagamentos como pagos no Financeiro confirma o recebimento.
        </p>
      )}
    </div>
  );
}
