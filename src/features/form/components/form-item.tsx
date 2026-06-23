"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { EllipsisIcon, EyeIcon, Globe, GlobeLock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DeleteFormModal } from "./delete-form-modal";
import { Trash2 } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch-variable";
import {
  Item,
  ItemContent,
  ItemActions,
  ItemHeader,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";
import { PublicVisibilityDialog } from "@/components/public-visibility-dialog";

type PropsType = {
  id: string;
  formId: string;
  name: string;
  responses: number;
  createdAt: Date;
  published: boolean;
  isPublicOnSpace?: boolean;
  handlePublish: (checked: boolean, id: string) => void;
};
export const FormItem = (props: PropsType) => {
  const {
    id,
    formId,
    name,
    published,
    isPublicOnSpace = false,
    createdAt,
    responses = 0,
    handlePublish,
  } = props;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false);
  const router = useRouter();

  // Mutation para alternar visibilidade na Spacehome
  const qc = useQueryClient();
  const togglePublicOnSpace = useMutation({
    ...orpc.form.togglePublicOnSpace.mutationOptions(),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({
        queryKey: orpc.form.list.queryOptions({ input: {} }).queryKey,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const onClick = useCallback(() => {
    router.push(`/form/builder/${formId}`);
  }, []);

  const onResponsesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/form/responses/${formId}`);
  }, []);

  return (
    <Item
      onClick={onClick}
      role="button"
      className="w-full hover:bg-foreground/10 transition-colors"
      variant={"outline"}
    >
      <ItemContent className="flex-row">
        <ItemHeader className="flex flex-col items-start gap-2">
          <ItemTitle>{name}</ItemTitle>
          <ItemDescription className="text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>
              {formatDistanceToNowStrict(new Date(createdAt), {
                addSuffix: true,
                locale: ptBR,
              })}
              {" • "}
              {responses} respostas
            </span>
            {isPublicOnSpace && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                <Globe className="h-2.5 w-2.5" />
                Spacehome
              </span>
            )}
          </ItemDescription>
        </ItemHeader>
      </ItemContent>

      <ItemActions
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Switch
          checked={published}
          onCheckedChange={(checked) => {
            handlePublish(checked, id);
          }}
        />
        <Button size={"icon-sm"} variant={"outline"} onClick={onResponsesClick}>
          <EyeIcon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <EllipsisIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/form/builder/${formId}`);
              }}
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/form/responses/${formId}`);
              }}
            >
              Ver Respostas
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              disabled={togglePublicOnSpace.isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (isPublicOnSpace) {
                  // desligar é seguro — dispensa confirmação
                  togglePublicOnSpace.mutate({
                    id: formId,
                    isPublicOnSpace: false,
                  });
                } else {
                  // ligar → abre dialog de consentimento
                  setPublicConfirmOpen(true);
                }
              }}
            >
              {isPublicOnSpace ? (
                <>
                  <GlobeLock className="h-4 w-4" />
                  Ocultar da Spacehome
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" />
                  Visualização Pública
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>

      <PublicVisibilityDialog
        open={publicConfirmOpen}
        onOpenChange={setPublicConfirmOpen}
        isPending={togglePublicOnSpace.isPending}
        onConfirm={() => {
          togglePublicOnSpace.mutate(
            { id: formId, isPublicOnSpace: true, consent: true },
            { onSuccess: () => setPublicConfirmOpen(false) },
          );
        }}
      />

      <DeleteFormModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        id={formId}
        formName={name}
      />
    </Item>
  );
};
