AbortSignal;
import { Grip } from "lucide-react";
import { OptionColumn } from "../option";
import { DraggableAttributes } from "@dnd-kit/core";
import { Column, Lead } from "../../list-column";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { Badge } from "@/components/ui/badge";
import { ComponentRef, RefObject, useRef, useState } from "react";
import { useEventListener } from "usehooks-ts";
import { Input } from "@/components/ui/input";
import { schema } from "./schema";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "@/components/ui/field";

interface HeaderColumnKanbanProps extends Column {
  leads: Lead[];
  title: string;
  attributes: DraggableAttributes;
  listeners?: SyntheticListenerMap;
}
type EditColumnForm = z.infer<typeof schema>;

export function HeaderColumnKanban({
  leads,
  title,
  attributes,
  listeners,
}: HeaderColumnKanbanProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRefer = useRef<ComponentRef<"input">>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditColumnForm>({
    resolver: zodResolver(schema),
  });

  function enableEditing() {
    setIsEditing(true);
    setTimeout(() => {
      inputRefer.current?.focus();
      inputRefer.current?.select();
    });
  }
  function onSubmit(data: EditColumnForm) {
    disableEditing();
    console.log(data);
  }

  function disableEditing() {
    setIsEditing(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
    }
  }

  //   function onBlur() {
  //     formRefer.current?.requestSubmit();
  //   }

  useEventListener("keydown", onKeyDown);

  return (
    <header className="flex flex-row px-2 h-12 justify-between items-center rounded-t-lg">
      <div className="flex flex-row justify-between gap-2 items-center w-full">
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="w-full">
            <Input
              {...register("title")}
              type="text"
              autoFocus
              placeholder="Insira o título da coluna"
              className="h-7 w-full"
            />
            {errors.title && <FieldError>{errors.title.message}</FieldError>}
          </form>
        ) : (
          <div className="flex flex-row items-center gap-2">
            <Grip
              className="cursor-grab active:cursor-grabbing touch-none size-4"
              {...attributes}
              {...listeners}
            />
            <span
              onClick={enableEditing}
              className="truncate line-clamp-1 max-w-32"
            >
              {title}
            </span>
            <Badge className="bg-foreground/5 text-muted-foreground">
              {leads.length || 0}
            </Badge>
          </div>
        )}
      </div>
      <OptionColumn />
    </header>
  );
}
