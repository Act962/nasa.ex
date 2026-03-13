import { useState } from "react";
import { useDeleteInsightShares } from "../../hooks/use-dashboard";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FieldDescription, FieldTitle } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2Icon } from "lucide-react";

interface DeleteInsightProps {
  children: React.ReactNode;
  id: string;
}

export function DeleteInsight({ children, id }: DeleteInsightProps) {
  const deleteMutation = useDeleteInsightShares();
  const [openModal, setOpenModal] = useState(false);

  function onSubmit() {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast("Insight deletado");
          setOpenModal(false);
        },
      },
    );
  }
  return (
    <Popover onOpenChange={setOpenModal} open={openModal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className={"space-y-4"}>
        <FieldTitle>
          Você tem certeza que quer deletar este relatório
        </FieldTitle>
        <FieldDescription>
          Ao deletar você poderá mais acessar a página externa deste relatório
        </FieldDescription>
        <div className={"flex w-full justify-between"}>
          <Button variant={"outline"} onClick={() => setOpenModal(false)}>
            Cancelar
          </Button>
          <Button variant={"destructive"} onClick={onSubmit}>
            Deletar {deleteMutation.isPending ? <Spinner /> : <Trash2Icon />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
