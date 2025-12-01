"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
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
import { useForm } from "react-hook-form";
import z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useStatus } from "@/context/status/hooks/use-status";
import { Skeleton } from "../ui/skeleton";
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
} from "../ui/tags";
import { useState } from "react";

const createLeadSchema = z.object({});

const defaultTags = [
  { id: "react", label: "React" },
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "nextjs", label: "Next.js" },
  { id: "vuejs", label: "Vue.js" },
  { id: "angular", label: "Angular" },
  { id: "svelte", label: "Svelte" },
  { id: "nodejs", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "ruby", label: "Ruby" },
  { id: "java", label: "Java" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "go", label: "Go" },
];

export default function AddLeadSheet() {
  const { isOpen, onClose, trackingId } = useAddLead();
  const form = useForm();
  const { status, isLoadingStatus } = useStatus(trackingId || "");
  const [newTag, setNewTag] = useState<string>("");
  const [tags, setTags] =
    useState<{ id: string; label: string }[]>(defaultTags);
  const [selected, setSelected] = useState<string[]>([]);

  const handleCreateTag = () => {
    console.log(`created: ${newTag}`);
    setTags((prev) => [
      ...prev,
      {
        id: newTag,
        label: newTag,
      },
    ]);
    setSelected((prev) => [...prev, newTag]);
    setNewTag("");
  };

  const handleRemove = (value: string) => {
    if (!selected.includes(value)) {
      return;
    }
    console.log(`removed: ${value}`);
    setSelected((prev) => prev.filter((v) => v !== value));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      handleRemove(value);
      return;
    }
    console.log(`selected: ${value}`);
    setSelected((prev) => [...prev, value]);
  };

  if (!trackingId) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Novo Lead</SheetTitle>
          <SheetDescription>Crie um novo lead para o tracking</SheetDescription>
        </SheetHeader>
        <form className="space-y-4 px-4">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="name">
              Nome <span className="text-red-500">*</span>
            </Label>
            <InputGroup>
              <InputGroupInput id="name" placeholder="Nome" autoFocus />
              <InputGroupAddon>
                <UserRoundPlus />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="phone">
              Telefone <span className="text-red-500">*</span>
            </Label>
            <InputGroup>
              <InputGroupInput id="phone" placeholder="Telefone" autoFocus />
              <InputGroupAddon>
                <Phone />
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="email">E-mail</Label>
            <InputGroup>
              <InputGroupInput id="email" placeholder="E-mail" autoFocus />
              <InputGroupAddon>
                <Mail />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="description">Descrição</Label>
            <InputGroup>
              <InputGroupTextarea
                id="description"
                placeholder="Descrição"
                autoFocus
              />
            </InputGroup>
          </div>

          <div className="flex flex-col gap-y-2 ">
            <Label htmlFor="description">Status</Label>
            {isLoadingStatus ? (
              <Skeleton className="h-10" />
            ) : (
              <Select defaultValue={status?.[0].id}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent className="w-[310px] sm:w-full overflow-x-hidden">
                  {status?.map((status) => (
                    <SelectItem
                      key={status.id}
                      value={status.id}
                      className="truncate"
                    >
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-y-2">
            <Label htmlFor="description">Tags</Label>
            <Tags>
              <TagsTrigger>
                {selected.map((tag) => (
                  <TagsValue key={tag} onRemove={() => handleRemove(tag)}>
                    {tags.find((t) => t.id === tag)?.label}
                  </TagsValue>
                ))}
              </TagsTrigger>
              <TagsContent>
                <TagsInput
                  onValueChange={setNewTag}
                  placeholder="Selecione uma tag..."
                />
                <TagsList>
                  <TagsEmpty>
                    <button
                      className="mx-auto flex cursor-pointer items-center gap-2"
                      onClick={handleCreateTag}
                      type="button"
                    >
                      <PlusIcon className="text-muted-foreground" size={14} />
                      Criar tag: {newTag}
                    </button>
                  </TagsEmpty>
                  <TagsGroup>
                    {tags.map((tag) => (
                      <TagsItem
                        key={tag.id}
                        onSelect={handleSelect}
                        value={tag.id}
                      >
                        {tag.label}
                        {selected.includes(tag.id) && (
                          <CheckIcon
                            className="text-muted-foreground"
                            size={14}
                          />
                        )}
                      </TagsItem>
                    ))}
                  </TagsGroup>
                </TagsList>
              </TagsContent>
            </Tags>
          </div>
        </form>
        <SheetFooter>
          <Button>Continuar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
