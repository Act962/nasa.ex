"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  EllipsisIcon,
  EyeIcon,
  Globe,
  LockKeyholeIcon,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
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

type PropsType = {
  id: string;
  formId: string;
  name: string;
  responses: number;
  createdAt: Date;
  published: boolean;
  handlePublish: (checked: boolean, id: string) => void;
};
export const FormItem = (props: PropsType) => {
  const {
    id,
    formId,
    name,
    published,
    createdAt,
    responses = 0,
    handlePublish,
  } = props;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const router = useRouter();

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
          <ItemDescription className="text-muted-foreground">
            {formatDistanceToNowStrict(new Date(createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
            {" • "}
            {responses} respostas
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
    </Item>
  );
};
