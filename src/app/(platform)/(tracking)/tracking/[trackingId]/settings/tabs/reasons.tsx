"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useReasons } from "@/context/reasons/hooks/use-reasons";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleX,
  Edit,
  Edit2,
  Info,
  Trash2,
  Trophy,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ReasonsProps {
  type: "WIN" | "LOSS";
  trackingId: string;
}

export function Reasons({ type, trackingId }: ReasonsProps) {
  const queryClient = useQueryClient();
  const { reasons, isLoading } = useReasons(trackingId, type);
  const [reason, setReason] = useState("");

  const mutation = useMutation(
    orpc.reasons.createReason.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["reasons", trackingId, type],
        });

        toast.success("Motivo adicionado com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao adicionar motivo.");
      },
    })
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reason) {
      toast.error("Digite um motivo.");
      return;
    }

    mutation.mutate({
      trackingId,
      type,
      name: reason,
    });

    setReason("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-foreground font-semibold text-xl flex items-center gap-2">
          {type === "WIN" ? (
            <Trophy className="size-5 text-primary" />
          ) : (
            <CircleX className="size-5 text-destructive" />
          )}
          {type === "WIN" ? "Motivos de ganho" : "Motivos de perda"}
        </h1>
        <span className="text-muted-foreground text-sm">
          {type === "WIN"
            ? "Cadastre os motivos pelos quais um lead foi ganho."
            : "Cadastre os motivos pelos quais um lead foi perdido."}
        </span>
      </div>

      <Alert>
        <Info />
        <AlertTitle>Esta seção registra motivos do lead</AlertTitle>
        <AlertDescription>
          Use esta lista para padronizar análises de{" "}
          {type === "WIN" ? "ganhos" : "perdas"}. Edite ou remova itens conforme
          necessário.
        </AlertDescription>
      </Alert>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          placeholder={
            type === "WIN"
              ? "Digite um motivo de ganho"
              : "Digite um motivo de perda"
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label={type === "WIN" ? "Motivo de ganho" : "Motivo de perda"}
        />
        <Button type="submit">Adicionar</Button>
      </form>

      <div className="space-y-2">
        {isLoading &&
          Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}

        {!isLoading && reasons.length === 0 && (
          <Alert>
            <Info />
            <AlertTitle>Nenhum motivo cadastrado</AlertTitle>
            <AlertDescription>
              Adicione o primeiro motivo de {type === "WIN" ? "ganho" : "perda"}{" "}
              para começar a organizar seus dados.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading &&
          reasons.map((reason) => (
            <ReasonItem key={reason.id} {...reason} trackingId={trackingId} />
          ))}
      </div>
    </div>
  );
}

interface ReasonItemProps {
  id: string;
  name: string;
  type: "WIN" | "LOSS";
  trackingId: string;
}

function ReasonItem({ id, name, type, trackingId }: ReasonItemProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(name || "");

  const createMutation = useMutation(
    orpc.reasons.updateReason.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["reasons", trackingId, type],
        });

        toast.success("Motivo atualizado com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar motivo.");
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.reasons.deleteReason.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["reasons", trackingId, type],
        });

        toast.success("Motivo deletado com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao deletar motivo.");
      },
    })
  );

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);
  };

  const enableInput = () => {
    setNewName(name);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
    }, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onUpdate();
      toggleEditing();
    }
  };

  const onDelete = () => {
    deleteMutation.mutate({
      id,
    });
  };

  const onUpdate = () => {
    if (!newName) {
      toast.error("Digite um motivo.");
      return;
    }

    createMutation.mutate({
      id,
      name: newName,
      type,
    });
  };

  if (isEditing) {
    return (
      <Item variant="outline" size="sm">
        <Input
          ref={inputRef}
          onClick={enableInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={toggleEditing}
        />
      </Item>
    );
  }

  return (
    <Item variant="outline" size="sm">
      <ItemHeader>
        <ItemTitle onClick={enableInput} className="cursor-text">
          {name}
        </ItemTitle>
        <ItemActions>
          <Button
            variant={"outline"}
            size="icon-sm"
            onClick={enableInput}
            aria-label="Editar motivo"
          >
            <Edit className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onDelete}
            aria-label="Excluir motivo"
          >
            <Trash2 className="size-4" />
          </Button>
        </ItemActions>
      </ItemHeader>
    </Item>
  );
}
