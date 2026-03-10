"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTag } from "@/features/tags/hooks/use-tag";
import {
  useDeleteTag,
  useQueryTags,
  useUpdateTag,
} from "@/features/tags/hooks/use-tags";
import { TagType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, TagIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryListTrackings } from "@/features/insights/hooks/use-dashboard";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
}

const tagSchema = z.object({
  name: z.string().min(1, "Campo obrigatório"),
  color: z.string(),
});

export function TagModal({ open, onOpenChange, trackingId }: Props) {
  const [trackingSelected, setTrackingSelected] = useState<string | undefined>(
    trackingId,
  );
  const form = useForm<z.infer<typeof tagSchema>>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_UI_COLORS[0],
    },
  });

  const { tags, isLoadingTags } = useQueryTags({
    trackingId,
  });

  const { trackings } = useQueryListTrackings();
  const createTag = useCreateTag();

  const watch = form.watch("name");

  const handleCreateTag = (data: z.infer<typeof tagSchema>) => {
    if (!trackingSelected) {
      toast("Selecione um tracking");
      return;
    }
    createTag.mutate({
      name: data.name,
      trackingId: trackingSelected,
      color: data.color,
    });
    form.reset();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tags</SheetTitle>
          <SheetDescription>
            Adicione tags para categorizar seus leads.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 ">
          {!trackingId && (
            <div className="px-4 space-y-2">
              <Label>Selecionar Tracking</Label>
              <Select
                disabled={isLoadingTags}
                value={trackingSelected}
                onValueChange={setTrackingSelected}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um tracking" />
                </SelectTrigger>
                <SelectContent>
                  {trackings?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <form
            onSubmit={form.handleSubmit(handleCreateTag)}
            className="px-4 space-y-2"
          >
            {!trackingId && <Label>Nova Tag</Label>}
            <InputGroup>
              <InputGroupAddon>
                <Popover>
                  <PopoverTrigger>
                    <div
                      className="size-5 rounded-sm cursor-pointer"
                      style={{ backgroundColor: form.watch("color") }}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_UI_COLORS.map((color) => {
                        const isSelected = form.watch("color") === color;
                        return (
                          <div
                            key={color}
                            className={cn(
                              "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                              isSelected && "ring-1 ring-offset-1 ring-primary",
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => form.setValue("color", color)}
                          />
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Adicionar tag"
                {...form.register("name")}
              />
              <InputGroupAddon align="inline-end">
                {watch.length > 0 && (
                  <Button size="icon-xs" type="submit">
                    <CheckIcon />
                  </Button>
                )}
              </InputGroupAddon>
            </InputGroup>
          </form>

          <Separator className="my-4" />

          <div className="px-4 h-full">
            <h3 className="font-medium">Tags cadastradas</h3>
            <div className="flex items-center flex-wrap gap-2 mt-2 overflow-y-auto max-h-[calc(100vh-13rem)]">
              {isLoadingTags &&
                Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="w-12 h-4" />
                ))}
              {!isLoadingTags &&
                tags.length > 0 &&
                tags.map((tag) => <TagItem key={tag.id} {...tag} />)}

              {!isLoadingTags && tags.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <TagIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma tag cadastrada</EmptyTitle>
                    <EmptyDescription>
                      Adicione tags para categorizar seus leads.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface TagItemProps {
  color: string;
  type: TagType;
  name: string;
  id: string;
  slug: string;
  description: string | null;
  icon: string | null;
  whatsappId: string | null;
}

const tagUpdateSchema = z.object({
  tagName: z.string().min(1, "Campo obrigatório"),
  colorName: z.string(),
});

export function TagItem(tag: TagItemProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof tagUpdateSchema>>({
    resolver: zodResolver(tagUpdateSchema),
    defaultValues: {
      tagName: tag.name,
      colorName: tag.color,
    },
  });
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const watch = form.watch("tagName");

  const handleDeleteTag = () => {
    deleteTag.mutate(
      {
        tagId: tag.id,
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  };

  const handleUpdateTag = (data: z.infer<typeof tagUpdateSchema>) => {
    updateTag.mutate(
      {
        tagId: tag.id,
        name: data.tagName,
        color: data.colorName,
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Badge
          key={tag.id}
          style={{
            backgroundColor: tag.color,
            color: getContrastColor(tag.color),
          }}
          className="cursor-pointer focus-visible:ring-0 outline-none"
        >
          {tag.name}
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="p-0">
        <form
          onSubmit={form.handleSubmit(handleUpdateTag)}
          className="flex items-center gap-2 p-2"
        >
          <InputGroup>
            <InputGroupAddon>
              <Popover>
                <PopoverTrigger>
                  <div
                    className="size-5 rounded-sm cursor-pointer"
                    style={{
                      backgroundColor: form.watch("colorName"),
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_UI_COLORS.map((color) => {
                      const isSelected = form.watch("colorName") === color;
                      return (
                        <div
                          key={color}
                          className={cn(
                            "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                            isSelected && "ring-1 ring-offset-1 ring-primary",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => form.setValue("colorName", color)}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Nome da tag"
              {...form.register("tagName")}
            />
            <InputGroupAddon align="inline-end">
              {watch.length > 0 && (
                <Button size="icon-xs" type="submit">
                  <CheckIcon />
                </Button>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Separator />
        <div className="p-2 flex items-center justify-end">
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={handleDeleteTag}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
