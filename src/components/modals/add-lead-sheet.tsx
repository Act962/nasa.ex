"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAddLead } from "@/hooks/use-add-lead-sheet";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";

import { CheckIcon, Mail, Phone, PlusIcon, UserRoundPlus } from "lucide-react";

import { Label } from "../ui/label";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import { useStatus } from "@/context/status/hooks/use-status";
import { Skeleton } from "../ui/skeleton";

import { useTags } from "@/context/tags/hooks/use-tags";
import { useTag } from "@/context/tags/hooks/use-tag";
import {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
} from "../ui/shadcn-io/tags";

import { useState } from "react";
import { FieldError } from "../ui/field";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Spinner } from "../ui/spinner";
import { toast } from "sonner";
import { useParams } from "next/navigation";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  phone: z.string().min(14, "Telefone inválido"),
  email: z.email("E-mail inválido").optional().or(z.literal("")),
  description: z.string().optional(),
  statusId: z.string().min(1, "Selecione um status"),
  tags: z.array(z.string()).optional(),
  position: z.enum(["first", "last"], {
    error: "Selecione uma posição",
  }),
});

type FormData = z.infer<typeof schema>;

function phoneMask(value: string) {
  value = value.replace(/\D/g, "");

  if (value.length > 11) value = value.slice(0, 11);

  if (value.length >= 11) {
    return value
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d{5})(\d{4})$/, "$1-$2");
  }

  return value
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d{4})(\d{4})$/, "$1-$2");
}

interface AddLeadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddLeadSheet({
  open,
  onOpenChange,
}: AddLeadSheetProps) {
  const queryClient = useQueryClient();
  const { trackingId } = useParams<{ trackingId: string }>();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      description: "",
      statusId: "",
      tags: [],
      position: "first",
    },
  });

  const onCreateLead = useMutation(
    orpc.leads.createWithTags.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: trackingId!,
            },
          }),
        });
        toast.success("Lead criado com sucesso");
        reset();
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Erro ao criar lead, tente novamente mais tarde!");
      },
    })
  );

  const { status, isLoadingStatus } = useStatus(trackingId ?? "");
  const { tags, isLoadingTags } = useTags({ trackingId });
  const { createTag } = useTag();
  const [newTag, setNewTag] = useState("");

  const selectedStatus = watch("statusId");
  const selectedTags = watch("tags") || [];

  const toggleTag = (id: string) => {
    const updated = selectedTags.includes(id)
      ? selectedTags.filter((t) => t !== id)
      : [...selectedTags, id];

    setValue("tags", updated);
    setNewTag("");
  };

  const removeTag = (id: string) => {
    setValue(
      "tags",
      selectedTags.filter((t) => t !== id)
    );
  };

  const handleCreateTag = () => {
    if (newTag.trim() === "") return;
    createTag.mutate({
      name: newTag,
      trackingId: trackingId!,
    });
    setNewTag("");
  };

  const selectedTagsData = tags?.filter((t) => selectedTags.includes(t.id));

  const onSubmit = (data: FormData) => {
    console.log("FORM DATA:", data);
    onCreateLead.mutate({
      name: data.name,
      phone: data.phone,
      email: data.email,
      description: data.description,
      statusId: data.statusId,
      trackingId: trackingId!,
      position: data.position,
      tagIds: selectedTags,
    });
  };

  const isCreatingLead = onCreateLead.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Novo Lead</SheetTitle>
          <SheetDescription>Crie um novo lead para o tracking</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 h-full overflow-y-auto px-4 pb-4"
        >
          {/* Nome */}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="name">
              Nome <span className="text-red-500">*</span>
            </Label>

            <InputGroup>
              <InputGroupInput
                id="name"
                placeholder="Nome"
                disabled={isCreatingLead}
                {...register("name")}
              />
              <InputGroupAddon>
                <UserRoundPlus />
              </InputGroupAddon>
            </InputGroup>

            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </div>

          {/* Telefone */}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="phone">
              Telefone <span className="text-red-500">*</span>
            </Label>

            <InputGroup>
              <InputGroupInput
                id="phone"
                placeholder="Telefone"
                disabled={isCreatingLead}
                {...register("phone")}
                onChange={(e) => setValue("phone", phoneMask(e.target.value))}
              />
              <InputGroupAddon>
                <Phone />
              </InputGroupAddon>
            </InputGroup>

            {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="email">E-mail</Label>

            <InputGroup>
              <InputGroupInput
                id="email"
                placeholder="E-mail"
                disabled={isCreatingLead}
                {...register("email")}
              />
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
            </InputGroup>

            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="description">Descrição</Label>
            <InputGroup>
              <InputGroupTextarea
                id="description"
                placeholder="Descrição"
                disabled={isCreatingLead}
                {...register("description")}
              />
            </InputGroup>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-y-2">
            <Label>Status</Label>

            {isLoadingStatus ? (
              <Skeleton className="h-10" />
            ) : (
              <Controller
                name="statusId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isCreatingLead}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}

            {errors.statusId && (
              <FieldError>{errors.statusId.message}</FieldError>
            )}
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="position">Posição</Label>

            <Controller
              name="position"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!selectedStatus || isCreatingLead}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma posição" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="first" className="cursor-pointer">
                      Início da coluna
                    </SelectItem>
                    <SelectItem value="last" className="cursor-pointer">
                      Fim da coluna
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />

            {errors.position && (
              <FieldError>{errors.position.message}</FieldError>
            )}
          </div>

          <div className="flex flex-col gap-y-2">
            <Label>Tags</Label>

            {isLoadingTags ? (
              <Skeleton className="h-10" />
            ) : (
              <Tags>
                <TagsTrigger
                  disabled={isCreatingLead}
                  placeholder="Selecione uma tag"
                >
                  {selectedTagsData?.map((tag) => (
                    <TagsValue key={tag.id} onRemove={() => removeTag(tag.id)}>
                      {tag.name}
                    </TagsValue>
                  ))}
                </TagsTrigger>

                <TagsContent>
                  <TagsInput
                    value={newTag}
                    onValueChange={setNewTag}
                    placeholder="Pesquisar tags..."
                  />

                  <TagsList>
                    <TagsEmpty>
                      <button
                        type="button"
                        className="mx-auto flex items-center gap-2"
                        onClick={handleCreateTag}
                      >
                        <PlusIcon size={14} />
                        Criar tag: {newTag}
                      </button>
                    </TagsEmpty>

                    <TagsGroup>
                      {tags?.map((tag) => (
                        <TagsItem
                          key={tag.id}
                          value={tag.name}
                          onSelect={() => toggleTag(tag.id)}
                        >
                          <span>{tag.name}</span>

                          {selectedTags.includes(tag.id) && (
                            <CheckIcon className="h-4 w-4 ml-auto" />
                          )}
                        </TagsItem>
                      ))}
                    </TagsGroup>
                  </TagsList>
                </TagsContent>
              </Tags>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isCreatingLead}>
            {isCreatingLead ? <Spinner /> : "Criar lead"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
