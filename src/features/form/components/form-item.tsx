"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  EllipsisIcon,
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

type PropsType = {
  id: string;
  formId: string;
  name: string;
  responses: number;
  views: number;
  createdAt: Date;
  published: boolean;
  backgroundColor: string;
};
export const FormItem = (props: PropsType) => {
  const {
    id,
    formId,
    name,
    published,
    createdAt,
    responses = 0,
    views = 0,
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
    <div onClick={onClick} role="button" className="w-full h-auto">
      <div className="w-full relative flex items-center justify-center overflow-hidden h-[150px] rounded-t-xl border bg-linear-to-b from-primary/10 to-primary/10">
        <div className=" w-36 absolute bottom-0 flex items-center flex-col px-4 pt-6 h-32 rounded-t-xl bg-white shadow-lg">
          <h5 className="text-sm font-medium mb-1 text-center text-gray-400 truncate block w-[200px]">
            {name}
          </h5>
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center gap-1 mb-2">
              <Skeleton className="h-3 w-3 rounded-full shrink-0" />
              <Skeleton className="h-[11px] w-[75px]" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-full py-0">
        <div className="flex w-full items-center justify-between py-1">
          <span className="text-sm flex items-center gap-1 font-medium">
            {published ? (
              <Globe className="text-muted-foreground size-3" />
            ) : (
              <LockKeyholeIcon className="text-muted-foreground size-3" />
            )}
            {name}
          </span>
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
        </div>

        <DeleteFormModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          id={id}
          formName={name}
        />
        <div className="flex w-full border-t border-foreground/30 items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <button onClick={onResponsesClick}>
              <span className="text-muted-foreground flex items-center gap-1 font-[14px]">
                {responses}
                <MessageSquare className="text-muted-foreground size-[14px]" />
              </span>
            </button>

            <span className="text-muted-foreground flex items-center gap-1 text-[14px]">
              {views}
              <ActivityIcon className="text-muted-foreground size-[14px]" />
            </span>
          </div>
          <span className="text-muted-foreground flex gap-1 text-[13px]">
            {formatDistanceToNowStrict(new Date(createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
