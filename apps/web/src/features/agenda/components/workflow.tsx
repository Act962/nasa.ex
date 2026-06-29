import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { Spinner } from "@/components/ui/spinner";
import { useStatus } from "@/features/status/hooks/use-status";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { useUpdateAgenda } from "../hooks/use-agenda";

const DEFAULT_STATUS_VALUE = "__default__";

const formSchema = z.object({
  trackingId: z.string().min(1, "Selecione um tracking"),
  statusId: z.string().nullable().optional(),
  tagIds: z.array(z.string()),
});

type FormSchema = z.infer<typeof formSchema>;

interface AgendaWorkflow {
  id: string;
  trackingId: string;
  statusId: string | null;
  tags: { id: string; name: string; color: string | null }[] ;
}

interface WorkflowProps {
  defaultValues: AgendaWorkflow;
}

export function Workflow({ defaultValues }: WorkflowProps) {
  const { trackings } = useQueryTrackings();
  const updateAgenda = useUpdateAgenda();

  const initialTrackingIdRef = useRef(defaultValues.trackingId);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      trackingId: defaultValues.trackingId,
      statusId: defaultValues.statusId ?? null,
      tagIds: defaultValues.tags?.map((t) => t.id) || [] ,
    },
  });

  const trackingId = form.watch("trackingId");
  const { status, isLoadingStatus } = useStatus(trackingId);
  const { tags, isLoadingTags } = useTags({ trackingId:undefined });

  // Reseta status/tags quando o tracking muda de fato (não no mount inicial).
  useEffect(() => {
    if (!trackingId) return;
    if (trackingId === initialTrackingIdRef.current) return;
    form.setValue("statusId", null);
    form.setValue("tagIds", []);
  }, [trackingId, form]);

  const [openTagsPopover, setOpenTagsPopover] = useState(false);

  const onSubmit = async (data: FormSchema) => {
    updateAgenda.mutate(
      {
        agendaId: defaultValues.id,
        trackingId: data.trackingId,
        statusId: data.statusId || null,
        tagIds: data.tagIds,
      },
      {
        onSuccess: () => {
          initialTrackingIdRef.current = data.trackingId;
        },
      },
    );
  };

  const isSubmitting = updateAgenda.isPending;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="bg-transparent">
        <CardContent className="space-y-4">
          <Controller
            control={form.control}
            name="trackingId"
            render={({ field }) => (
              <Field>
                <FieldLabel>Tracking</FieldLabel>
                <Select
                  disabled={isSubmitting}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tracking" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackings.map((tracking) => (
                      <SelectItem key={tracking.id} value={tracking.id}>
                        {tracking.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>
                  {form.formState.errors.trackingId?.message}
                </FieldError>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="statusId"
            render={({ field }) => (
              <Field>
                <FieldLabel>Status inicial do lead</FieldLabel>
                <Select
                  disabled={isSubmitting || !trackingId || isLoadingStatus}
                  name={field.name}
                  value={field.value ?? DEFAULT_STATUS_VALUE}
                  onValueChange={(value) =>
                    field.onChange(
                      value === DEFAULT_STATUS_VALUE ? null : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_STATUS_VALUE}>
                      Selecione
                    </SelectItem>
                    {status.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>
                  {form.formState.errors.statusId?.message}
                </FieldError>
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="tagIds"
            render={({ field }) => (
              <Field>
                <FieldLabel>Tags iniciais do lead</FieldLabel>
                <Popover
                  open={openTagsPopover}
                  onOpenChange={setOpenTagsPopover}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={openTagsPopover}
                      disabled={isSubmitting || !trackingId}
                      className="w-full justify-start h-auto min-h-10 py-2"
                    >
                      <div className="flex flex-wrap gap-1 ">
                        {field.value && field.value.length > 0 ? (
                          <>
                            {field.value.slice(0, 5).map((id) => {
                              const tag = tags.find((t) => t.id === id);
                              return (
                                <Badge
                                  key={id}
                                  variant="secondary"
                                  className="font-normal"
                                  style={{
                                    backgroundColor: tag?.color || undefined,
                                    color: tag?.color ? "#fff" : undefined,
                                  }}
                                >
                                  {tag?.name || id}
                                </Badge>
                              );
                            })}
                            {field.value.length > 5 && (
                              <Badge
                                variant="outline"
                                className="font-normal"
                              >
                                +{field.value.length - 5}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Selecione as tags...
                          </span>
                        )}
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar tag..." />
                      <CommandList
                        onWheel={(e) => e.stopPropagation()}
                        className="min-h-0 max-h-60 overflow-y-auto scroll-cols-tracking" 
                      >
                        {isLoadingTags ? (
                          <div className="flex items-center justify-center p-4">
                            <Spinner />
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>
                              Nenhuma tag encontrada.
                            </CommandEmpty>
                            <CommandGroup>
                              {tags.map((tag) => {
                                const isSelected = field.value?.includes(
                                  tag.id,
                                );
                                return (
                                  <CommandItem
                                    key={tag.id}
                                    value={`${tag.id}-${tag.name}`}
                                    onSelect={() => {
                                      const current = field.value || [];
                                      const next = isSelected
                                        ? current.filter(
                                            (id) => id !== tag.id,
                                          )
                                        : [...current, tag.id];
                                      field.onChange(next);
                                    }}
                                  >
                                    <div
                                      className={cn(
                                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        isSelected
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50 [&_svg]:invisible",
                                      )}
                                    >
                                      <Check className="h-4 w-4" />
                                    </div>
                                    <span>{tag.name}</span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FieldError>
                  {form.formState.errors.tagIds?.message}
                </FieldError>
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting && <Spinner />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
