import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, FolderIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTag } from "@/features/tags/hooks/use-tag";
import { useTagGroups } from "@/features/tags/hooks/use-tag-groups";
import { tagFormSchema, type TagFormSchema } from "@/features/tags/schema";
import { useQueryListTrackings } from "@/features/insights/hooks/use-dashboard";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";
import { TagGroupManager } from "@/features/tags/components/tag-group-manager";
import { ColorPicker } from "./color-picker";

interface TagCreateFormProps {
  open: boolean;
  trackingId?: string;
}

export function TagCreateForm({ open, trackingId }: TagCreateFormProps) {
  const [trackingSelected, setTrackingSelected] = useState<string | undefined>(
    trackingId,
  );
  const [scopeToTracking, setScopeToTracking] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [selectedGroupForCreate, setSelectedGroupForCreate] = useState<
    string | null
  >(null);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_UI_COLORS[0],
      description: "",
    },
  });

  const { trackings, isLoading: isLoadingTrackings } = useQueryListTrackings();
  const { data: groupsData } = useTagGroups();
  const createTag = useCreateTag();
  const { ref: nameInputRegisterRef, ...nameInputProps } =
    form.register("name");
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
    if (scopeToTracking && !trackingSelected) {
      toast.error("Selecione um tracking pra limitar a tag");
      return;
    }
    const trimmedDescription = data.description?.trim() ?? "";
    createTag.mutate(
      {
        name: data.name,
        trackingId: scopeToTracking ? (trackingSelected ?? null) : null,
        color: data.color,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        tagGroupId: selectedGroupForCreate,
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
    <>
      <div className="px-4 space-y-2 border rounded-md p-3 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="scope-toggle" className="cursor-pointer">
            Limitar a este tracking
          </Label>
          <Switch
            id="scope-toggle"
            checked={scopeToTracking}
            onCheckedChange={setScopeToTracking}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {scopeToTracking
            ? "Tag vai existir só no tracking selecionado."
            : "Tag fica disponível em todos os trackings da organização (recomendado)."}
        </p>
        {scopeToTracking && (
          <Select
            disabled={isLoadingTrackings}
            value={trackingSelected}
            onValueChange={setTrackingSelected}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um tracking" />
            </SelectTrigger>
            <SelectContent>
              {trackings?.map((tracking) => (
                <SelectItem key={tracking.id} value={tracking.id}>
                  {tracking.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <form
        onSubmit={form.handleSubmit(handleCreateTag)}
        className="px-4 space-y-2"
      >
        {!trackingId && <Label>Nova Tag</Label>}
        <InputGroup>
          <InputGroupAddon>
            <ColorPicker
              value={tagColor}
              onChange={(color) => form.setValue("color", color)}
            />
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

        <div className="flex items-center gap-2">
          <Select
            value={selectedGroupForCreate ?? "__none__"}
            onValueChange={(value) =>
              setSelectedGroupForCreate(value === "__none__" ? null : value)
            }
          >
            <SelectTrigger className="flex-1 h-9">
              <SelectValue placeholder="Sem categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {(groupsData?.groups ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: group.color }}
                    />
                    {group.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setGroupManagerOpen(true)}
            title="Gerenciar grupos"
          >
            <FolderIcon className="size-3.5" />
          </Button>
        </div>
      </form>

      <TagGroupManager
        open={groupManagerOpen}
        onOpenChange={setGroupManagerOpen}
      />
    </>
  );
}
