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
import { useQueryTags } from "@/features/tags/hooks/use-tags";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, TagIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createTagSchema = z.object({
  name: z.string().min(1, "Campo obrigatório"),
});

export function TagModal({ open, onOpenChange }: Props) {
  const form = useForm<z.infer<typeof createTagSchema>>({
    resolver: zodResolver(createTagSchema),
    defaultValues: {
      name: "",
    },
  });

  const { trackingId } = useParams<{ trackingId: string }>();
  const { tags, isLoadingTags } = useQueryTags({
    trackingId,
  });
  const createTag = useCreateTag();

  const watch = form.watch("name");

  const handleCreateTag = (data: z.infer<typeof createTagSchema>) => {
    createTag.mutate({
      name: data.name,
      trackingId: trackingId,
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
        <div className="space-y-2">
          <form onSubmit={form.handleSubmit(handleCreateTag)} className="px-4">
            <InputGroup>
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

          <div className="px-4">
            <h3 className="font-medium">Tags cadastradas</h3>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {isLoadingTags &&
                Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="w-12 h-4" />
                ))}
              {!isLoadingTags &&
                tags.length > 0 &&
                tags.map((tag) => (
                  <Badge key={tag.id} className="">
                    {tag.name}
                  </Badge>
                ))}

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
