import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArchiveIcon,
  CheckIcon,
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteTag,
  useReferencedWorkflows,
  useUpdateTag,
} from "@/features/tags/hooks/use-tags";
import { useTagGroups } from "@/features/tags/hooks/use-tag-groups";
import { tagFormSchema, type TagFormSchema } from "@/features/tags/schema";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { ColorPicker } from "./color-picker";
import type { TagItemProps } from "./types";

export function TagItem(tag: TagItemProps) {
  const [open, setOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color,
      description: tag.description ?? "",
    },
  });
  const [editGroupId, setEditGroupId] = useState<string | null>(
    tag.tagGroupId ?? null,
  );
  const { data: groupsData } = useTagGroups();
  const [showDescription, setShowDescription] = useState(
    Boolean(tag.description),
  );
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const tagName = form.watch("name");
  const tagColor = form.watch("color");
  const automationCount = tag.automationCount ?? 0;

  const { data: workflowsData, isLoading: loadingWorkflows } =
    useReferencedWorkflows(confirmArchive || showWorkflows ? tag.id : null);

  const handleArchive = () => {
    if (automationCount > 0) {
      setConfirmArchive(true);
      return;
    }
    archiveNow();
  };

  const archiveNow = () => {
    deleteTag.mutate(
      { tagId: tag.id },
      {
        onSuccess: () => {
          setOpen(false);
          setConfirmArchive(false);
        },
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
        tagGroupId: editGroupId,
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
          className="cursor-pointer focus-visible:ring-0 outline-none gap-1"
        >
          {tag.name}
          {(tag.leadCount ?? 0) > 0 && (
            <span
              className="inline-flex items-center justify-center size-4 rounded-full bg-blue-500 text-white text-[9px] font-bold leading-none gap-0.5"
              title={`${tag.leadCount} lead(s) vinculado(s)`}
            >
              <UsersIcon className="size-2" />
              {tag.leadCount}
            </span>
          )}
          {automationCount > 0 && (
            <span
              className="inline-flex items-center justify-center size-4 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none gap-0.5"
              title={`${automationCount} automação${automationCount > 1 ? "ões" : ""} usa(m) essa tag`}
            >
              <ZapIcon className="size-2" />
              {automationCount}
            </span>
          )}
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="p-0">
        <form
          onSubmit={form.handleSubmit(handleUpdateTag)}
          className="flex flex-col gap-2 p-2"
        >
          <InputGroup>
            <InputGroupAddon>
              <ColorPicker
                value={tagColor}
                onChange={(color) => form.setValue("color", color)}
              />
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

          <div className="flex items-center gap-2">
            <FolderIcon className="size-3.5 text-muted-foreground shrink-0" />
            <Select
              value={editGroupId ?? "__none__"}
              onValueChange={(value) => {
                const newGroupId = value === "__none__" ? null : value;
                setEditGroupId(newGroupId);
                updateTag.mutate({
                  tagId: tag.id,
                  name: tag.name,
                  color: tag.color,
                  tagGroupId: newGroupId,
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
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
          </div>
        </form>
        <Separator />
        <div className="px-2 py-1.5 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-blue-600">
            <UsersIcon className="size-3" />
            <b>{tag.leadCount ?? 0}</b> lead(s)
          </span>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => {
              if (automationCount > 0) setShowWorkflows((value) => !value);
            }}
            className={cn(
              "inline-flex items-center gap-1 transition-colors",
              automationCount > 0
                ? "text-amber-600 hover:text-amber-700 cursor-pointer"
                : "text-muted-foreground",
            )}
            disabled={automationCount === 0}
            title={automationCount > 0 ? "Clique pra ver workflows" : undefined}
          >
            <ZapIcon className="size-3" />
            <b>{automationCount}</b> integração(ões)
            {automationCount > 0 && (
              <ChevronRightIcon
                className={cn(
                  "size-3 transition-transform",
                  showWorkflows && "rotate-90",
                )}
              />
            )}
          </button>
        </div>

        {showWorkflows && (
          <div className="px-2 pb-2 max-h-32 overflow-y-auto border-t bg-muted/30">
            {loadingWorkflows && (
              <p className="text-[10px] text-muted-foreground py-2">
                Carregando workflows...
              </p>
            )}
            {!loadingWorkflows && workflowsData?.workflows.length === 0 && (
              <p className="text-[10px] text-muted-foreground py-2">
                Nenhum workflow ativo encontrado.
              </p>
            )}
            {workflowsData?.workflows.map((workflow) => (
              <div
                key={`${workflow.workflowId}-${workflow.nodeType}`}
                className="flex items-center justify-between gap-2 py-1 text-[10px]"
              >
                <span className="truncate" title={workflow.name}>
                  {workflow.name}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 shrink-0">
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[9px]",
                      workflow.nodeType === "TAG"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                    )}
                  >
                    {workflow.nodeType === "TAG" ? "Ação" : "Gatilho"}
                  </span>
                  {workflow.trackingName && (
                    <span className="truncate max-w-[80px]">
                      · {workflow.trackingName}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <Separator />
        <div className="p-2 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleArchive}
            title="Arquivar tag (preserva histórico)"
          >
            <ArchiveIcon className="size-4" />
            Arquivar
          </Button>
        </div>
      </PopoverContent>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar tag &ldquo;{tag.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Essa tag está referenciada em <b>{automationCount}</b> automação
              (ões). Após arquivar:
              <ul className="list-disc list-inside mt-2 text-xs space-y-0.5">
                <li>
                  Automações com <b>ação TAG ADD</b> continuam rodando mas
                  vão pular essa tag (skip silencioso, sem erro)
                </li>
                <li>
                  Automações com <b>gatilho LEAD_TAGGED</b> nunca mais vão
                  disparar (porque ninguém vai anexar essa tag)
                </li>
                <li>
                  Histórico de leads que já tinham a tag <b>permanece</b>{" "}
                  (Jornada, Insights, /contatos)
                </li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/30">
            {loadingWorkflows ? (
              <div className="text-xs text-muted-foreground">
                Carregando workflows...
              </div>
            ) : workflowsData?.workflows.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nenhum workflow ativo encontrado.
              </div>
            ) : (
              <ul className="space-y-1">
                {workflowsData?.workflows.map((workflow) => (
                  <li
                    key={`${workflow.workflowId}-${workflow.nodeType}`}
                    className="text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{workflow.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                      <span
                        className={cn(
                          "rounded px-1 py-0.5",
                          workflow.nodeType === "TAG"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                        )}
                      >
                        {workflow.nodeType === "TAG" ? "Ação" : "Gatilho"}
                      </span>
                      {workflow.trackingName && (
                        <span>· {workflow.trackingName}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={archiveNow}
              disabled={deleteTag.isPending}
            >
              {deleteTag.isPending ? "Arquivando..." : "Arquivar mesmo assim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Popover>
  );
}
