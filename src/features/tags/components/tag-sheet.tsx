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
  useTags,
  useUpdateTag,
} from "@/features/tags/hooks/use-tags";
import { tagFormSchema, type TagFormSchema } from "@/features/tags/schema";
import { TagType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, PlusIcon, TagIcon, Trash2Icon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryListTrackings } from "@/features/insights/hooks/use-dashboard";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
}

export function TagSheet({ open, onOpenChange, trackingId }: Props) {
  const [trackingSelected, setTrackingSelected] = useState<string | undefined>(
    trackingId,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_UI_COLORS[0],
      description: "",
    },
  });
  const [showDescription, setShowDescription] = useState(false);

  const { tags, isLoadingTags } = useTags({ trackingId: "ALL" });

  const { trackings } = useQueryListTrackings();
  const createTag = useCreateTag();
  const { ref: nameInputRegisterRef, ...nameInputProps } = form.register("name");
  const tagName = form.watch("name");
  const tagColor = form.watch("color");

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    setTrackingSelected(trackingId);
  }, [trackingId]);

  const handleCreateTag = (data: TagFormSchema) => {
    if (!trackingSelected) {
      toast.error("Selecione um tracking");
      return;
    }
    const trimmedDescription = data.description?.trim() ?? "";
    createTag.mutate(
      {
        name: data.name,
        trackingId: trackingSelected,
        color: data.color,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
      },
      {
        onSuccess: () => {
          form.reset({
            name: "",
            color: data.color,
            description: "",
          });
          setShowDescription(false);
          inputRef.current?.focus();
        },
      },
    );
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
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Selecionar cor"
                      className="size-5 rounded-sm cursor-pointer"
                      style={{ backgroundColor: tagColor }}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_UI_COLORS.map((color) => {
                        const isSelected = tagColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Cor ${color}`}
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
                ref={(element) => {
                  nameInputRegisterRef(element);
                  inputRef.current = element;
                }}
                placeholder="Adicionar tag"
                {...nameInputProps}
                autoFocus
              />
              <InputGroupAddon align="inline-end">
                <Button
                  size="icon-xs"
                  type="submit"
                  disabled={!tagName || tagName.length === 0 || createTag.isPending}
                >
                  <CheckIcon />
                </Button>
              </InputGroupAddon>
            </InputGroup>

            {showDescription ? (
              <Textarea
                placeholder="Descrição da tag"
                rows={3}
                {...form.register("description")}
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowDescription(true)}
              >
                <PlusIcon className="size-3" />
                Adicionar descrição
              </Button>
            )}
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

export function TagItem(tag: TagItemProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color,
      description: tag.description ?? "",
    },
  });
  const [showDescription, setShowDescription] = useState(
    Boolean(tag.description),
  );
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const tagName = form.watch("name");
  const tagColor = form.watch("color");

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

  const handleUpdateTag = (data: TagFormSchema) => {
    const trimmedDescription = data.description?.trim() ?? "";
    updateTag.mutate(
      {
        tagId: tag.id,
        name: data.name,
        color: data.color,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset(data);
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
          className="flex flex-col gap-2 p-2"
        >
          <InputGroup>
            <InputGroupAddon>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Selecionar cor"
                    className="size-5 rounded-sm cursor-pointer"
                    style={{
                      backgroundColor: tagColor,
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_UI_COLORS.map((color) => {
                      const isSelected = tagColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Cor ${color}`}
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
              placeholder="Nome da tag"
              {...form.register("name")}
            />
            <InputGroupAddon align="inline-end">
              <Button
                size="icon-xs"
                type="submit"
                disabled={!tagName || tagName.length === 0 || updateTag.isPending}
              >
                <CheckIcon />
              </Button>
            </InputGroupAddon>
          </InputGroup>

          {showDescription ? (
            <Textarea
              placeholder="Descrição da tag"
              rows={3}
              {...form.register("description")}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setShowDescription(true)}
            >
              <PlusIcon className="size-3" />
              Adicionar descrição
            </Button>
          )}
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
