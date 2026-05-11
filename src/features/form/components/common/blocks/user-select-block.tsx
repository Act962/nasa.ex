import { useEffect, useState } from "react";
import { ChevronDown, User as UserIcon, Users as UsersIcon, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { orpc } from "@/lib/orpc";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

function useOrgMembers() {
  return useQuery({
    ...orpc.orgs.listMembers.queryOptions({
      input: { query: { userIds: undefined } },
    }),
    retry: false,
  });
}

function buildBlock(
  blockType: FormBlockType,
  multiple: boolean,
  defaultLabel: string,
  btnLabel: string,
  Icon: React.ElementType,
): ObjectBlockType {
  return {
    blockType,
    blockCategory: "Field",
    createInstance: (id) => ({
      id,
      blockType,
      attributes: { label: defaultLabel, helperText: "", required: false } satisfies AttributesType,
    }),
    blockBtnElement: { icon: Icon, label: btnLabel },
    canvasComponent: ({ blockInstance }) => (
      <CanvasView blockInstance={blockInstance} multiple={multiple} btnLabel={btnLabel} />
    ),
    formComponent: (props) => <FormView {...props} multiple={multiple} />,
    propertiesComponent: (props) => <PropertiesView {...props} headerLabel={btnLabel} />,
  };
}

export const UserSelectBlock = buildBlock(
  "UserSelect",
  false,
  "Responsável",
  "Usuário",
  UserIcon,
);

export const MultiUserSelectBlock = buildBlock(
  "MultiUserSelect",
  true,
  "Responsáveis",
  "Múltiplos usuários",
  UsersIcon,
);

type Instance = FormBlockInstance & { attributes: AttributesType };

function CanvasView({
  blockInstance,
  multiple,
  btnLabel,
}: {
  blockInstance: FormBlockInstance;
  multiple: boolean;
  btnLabel: string;
}) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">
          {label}
          {required && <span className="text-red-500"> *</span>}
          <span className="text-xs text-muted-foreground ml-2">({btnLabel})</span>
        </Label>
      )}
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={multiple ? "Selecione um ou mais usuários" : "Selecione um usuário"} />
        </SelectTrigger>
      </Select>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
  multiple,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
  multiple: boolean;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText } = block.attributes;
  const { data, isLoading, isError: queryFailed } = useOrgMembers();
  const members = data?.members ?? [];

  // Prefill: usamos `meta.ids` (lista de IDs) salva no submit anterior.
  // Fallback: tenta extrair nomes do `value` (CSV) e mapear pra IDs por name
  // — útil pra respostas antigas sem `meta`.
  const prefill = usePrefillFieldValue(block.id);
  const initialIds: string[] = (() => {
    if (!prefill) return [];
    const metaIds = (prefill.meta as { ids?: unknown } | undefined)?.ids;
    if (Array.isArray(metaIds)) return metaIds.filter((x): x is string => typeof x === "string");
    return [];
  })();
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [isError, setIsError] = useState(false);

  // Quando os members chegarem do servidor, tenta resolver o fallback por
  // nome (caso `meta.ids` não exista) e propaga via handleBlur.
  useEffect(() => {
    if (!prefill || members.length === 0) return;
    if (selected.length > 0) {
      // Já temos IDs do meta — só notifica o handleBlur uma vez.
      const picked = members.filter((m) => selected.includes(m.id));
      handleBlur?.(block.id, {
        value: picked.map((p) => p.name).join(", "),
        meta: {
          ids: selected,
          members: picked.map((p) => ({ id: p.id, name: p.name, email: p.email })),
        },
      });
      return;
    }
    // Sem IDs no meta — tenta casar por nome (CSV).
    const names = (prefill.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const matched = members.filter((m) => names.includes(m.name));
    if (matched.length > 0) {
      const ids = matched.map((m) => m.id);
      setSelected(ids);
      handleBlur?.(block.id, {
        value: matched.map((m) => m.name).join(", "),
        meta: {
          ids,
          members: matched.map((m) => ({ id: m.id, name: m.name, email: m.email })),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  function commit(ids: string[]) {
    setSelected(ids);
    const isValid = !required || ids.length > 0;
    setIsError(!isValid);
    const picked = members.filter((m) => ids.includes(m.id));
    handleBlur?.(block.id, {
      value: picked.map((p) => p.name).join(", "),
      meta: { ids, members: picked.map((p) => ({ id: p.id, name: p.name, email: p.email })) },
    });
  }

  if (queryFailed) {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label?.trim() && (
          <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">{label}</Label>
        )}
        <Input
          placeholder="Digite o nome do responsável"
          onBlur={(e) =>
            handleBlur?.(block.id, { value: e.target.value, meta: { freeText: true } })
          }
        />
        {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label
          className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      <Select
        value={multiple ? "" : selected[0] ?? ""}
        onValueChange={(v) => {
          if (multiple) {
            if (!selected.includes(v)) commit([...selected, v]);
          } else {
            commit([v]);
          }
        }}
        disabled={isLoading}
      >
        <SelectTrigger className={isError || isSubmitError ? "border-red-500!" : ""}>
          <SelectValue placeholder={multiple ? "Adicione usuários" : "Selecione um usuário"} />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  {m.image && <AvatarImage src={m.image} />}
                  <AvatarFallback className="text-[10px]">{m.name?.[0]}</AvatarFallback>
                </Avatar>
                {m.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {selected.map((id) => {
            const m = members.find((x) => x.id === id);
            if (!m) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                <span>{m.name}</span>
                <button
                  type="button"
                  onClick={() => commit(selected.filter((s) => s !== id))}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Selecione ao menos um usuário."}</p>
      )}
    </div>
  );
}

function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
  headerLabel,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
  headerLabel: string;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock } = useBuilderStore();
  const form = useForm<PropertiesType>({
    resolver: zodResolver(propertiesValidateSchema),
    mode: "onBlur",
    defaultValues: { ...block.attributes },
  });

  useEffect(() => form.reset({ ...block.attributes }), [block.attributes, form]);

  function commit(partial: Partial<AttributesType>) {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, {
      ...block,
      attributes: { ...block.attributes, ...partial },
    });
  }

  return (
    <div className="w-full pb-4">
      <div className="w-full flex flex-row items-center justify-between gap-1 bg-foreground/10 rounded-md h-auto p-1 px-2 mb-[10px]">
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          {headerLabel} {positionIndex}
        </span>
        <ChevronDown className="w-4 h-4" />
      </div>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-3 px-4">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Título</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ label: e.target.value }); }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="helperText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">Nota</FormLabel>
                <FormControl>
                  <Input {...field} onChange={(e) => { field.onChange(e); commit({ helperText: e.target.value }); }} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="required"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Obrigatório</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={(v) => { field.onChange(v); commit({ required: v }); }} />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}

