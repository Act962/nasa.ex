"use client";

import { Plus, X } from "lucide-react";
import { StatusWrapper } from "./status-wrapper";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SketchPicker } from "react-color";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateStatus } from "@/features/status/hooks/use-status";

const createStatusSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
});

type CreateStatusSchema = z.infer<typeof createStatusSchema>;

export const StatusForm = () => {
  const params = useParams<{ trackingId: string }>();
  const form = useForm<CreateStatusSchema>({
    resolver: zodResolver(createStatusSchema),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [colorSelect, setColorSelect] = useState("");
  const createStatus = useCreateStatus({
    trackingId: params.trackingId,
    onSuccess() {
      setIsEditing(false);
      form.reset();
    },
  });

  const toggleEditing = () => {
    setIsEditing((prev) => !prev);

    const length = 6;
    let result = "#";
    const characters = "0123456789abcdef";

    for (let i = 0; i < length; i++) {
      result += characters[Math.floor(Math.random() * characters.length)];
    }
    setColorSelect(result);
  };

  const onSubmit = (data: CreateStatusSchema) => {
    createStatus.mutate({
      name: data.name,
      trackingId: params.trackingId,
      color: colorSelect ?? "#1341D0",
    });
  };

  const isLoading = createStatus.isPending;

  if (isEditing) {
    return (
      <StatusWrapper>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full p-3 rounded-md bg-muted/80 space-y-4 shadow-md"
        >
          <div className="flex flex-row w-full items-center justify-center gap-x-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger>
                <div
                  className={`cursor-pointer flex w-6 h-6 rounded-sm`}
                  style={{ backgroundColor: colorSelect }}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-45 items-center justify-center"
                align="end"
              >
                <DropdownMenuLabel>Cor do status</DropdownMenuLabel>
                <div>
                  <SketchPicker
                    width="88%"
                    color={colorSelect}
                    onChange={(e) => setColorSelect(e.hex)}
                    disableAlpha
                    presetColors={[
                      "#FFFFFF",
                      "#595D66",
                      "#f6fa14",
                      "#1090E0",
                      "#EE5E99",
                      "#3DB88B",
                      "#E16B16",
                      "#B660E0",
                      "#FE5050",
                      "#FAB515",
                      "#7A5FDF",
                      "#000000",
                    ]}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              autoFocus
              {...form.register("name")}
              id="title"
              placeholder="Digite um nome..."
              className="text-sm px-2 py-1 h-7 font-medium"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center gap-x-1">
            <Button size="sm" type="submit" disabled={isLoading}>
              Adicionar
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              type="button"
              variant="ghost"
              size="icon-sm"
            >
              <X />
            </Button>
          </div>
        </form>
      </StatusWrapper>
    );
  }

  return (
    <StatusWrapper>
      <button
        onClick={toggleEditing}
        className="w-full rounded-md bg-muted/80 hover:bg-muted/90 transition p-3 flex items-center font-medium text-sm gap-2"
      >
        <Plus className="size-4" />
        Adicionar um status
      </button>
    </StatusWrapper>
  );
};
