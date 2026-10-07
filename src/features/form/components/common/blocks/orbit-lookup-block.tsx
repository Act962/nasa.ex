import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { useFormRecordLookup } from "@/features/form-records/hooks/use-form-record-lookup";
import { useRecordFillStore } from "@/features/form-records/hooks/use-record-fill-store";
import {
  buildOrbitLookupValue,
  filterInlineOptions,
  parseInlineOptions,
  parseOrbitLookupMeta,
  type LookupSource,
} from "@/features/form-records/lib/orbit-lookup-value";

// Bloco "Busca no Órbita" (spec 0075, RF-7): caixa de busca que sugere dados
// já cadastrados e sempre aceita o que foi digitado. Sem login (formulário
// público) só a lista do próprio campo sugere; as demais fontes viram texto.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "OrbitLookup";
const SEARCH_DEBOUNCE_MS = 250;

const SOURCE_LABELS: Record<LookupSource, string> = {
  LEADS: "Clientes (leads)",
  RECORDS: "Fichas de outro formulário",
  PRODUCTS: "Itens do catálogo",
  INLINE: "Lista própria deste campo",
};

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  placeHolder: string;
  source: LookupSource;
  sourceFormId: string;
  inlineOptions: string[];
};

type Instance = FormBlockInstance & { attributes: AttributesType };

interface Suggestion {
  id: string | null;
  label: string;
  detail: string | null;
  fields: Record<string, string>;
}

export const OrbitLookupBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: {
      label: "Buscar",
      helperText: "",
      required: false,
      placeHolder: "Digite para buscar",
      source: "LEADS",
      sourceFormId: "",
      inlineOptions: [],
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Search, label: "Busca no Órbita" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

function BlockLabel({ label, required, hasError }: { label: string; required: boolean; hasError?: boolean }) {
  if (!label?.trim()) return null;
  return (
    <Label className={`mb-2 whitespace-normal break-words text-base font-normal! leading-snug ${hasError ? "text-destructive" : ""}`}>
      {label}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText, placeHolder, source } = (blockInstance as Instance).attributes;
  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} />
      <div className="pointer-events-none relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input readOnly placeholder={placeHolder} className="pl-9" />
      </div>
      <p className="text-[0.8rem] text-muted-foreground">Busca em: {SOURCE_LABELS[source]}</p>
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText, placeHolder, source, sourceFormId, inlineOptions } = block.attributes;

  const saved = usePrefillFieldValue(block.id);
  const [text, setText] = useState(saved?.value ?? "");
  const [refId, setRefId] = useState<string | null>(parseOrbitLookupMeta(saved?.meta)?.refId ?? null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const fillRecordFields = useRecordFillStore((state) => state.fill);
  const clearRecordFields = useRecordFillStore((state) => state.clear);
  // O dado puxado vale só para este preenchimento: não vaza para a próxima ficha.
  useEffect(() => clearRecordFields, [clearRecordFields]);

  const { data: session } = authClient.useSession();
  const isServerSource = source !== "INLINE";
  const canSearchServer = isServerSource && Boolean(session?.user);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const lookup = useFormRecordLookup({
    source: isServerSource ? source : "LEADS",
    query: debouncedQuery,
    sourceFormId: sourceFormId || undefined,
    enabled: canSearchServer && isOpen,
  });

  const suggestions: Suggestion[] = isServerSource
    ? (lookup.data?.options ?? [])
    : filterInlineOptions(inlineOptions, text).map((option) => ({ id: null, label: option, detail: null, fields: {} }));

  const publish = (nextText: string, nextRefId: string | null) => {
    handleBlur?.(block.id, buildOrbitLookupValue({ text: nextText, source, refId: nextRefId }));
  };

  // Resposta salva entra no formulário mesmo sem o usuário tocar no campo.
  useEffect(() => {
    if (saved?.value) publish(saved.value, refId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (suggestion: Suggestion) => {
    setText(suggestion.label);
    setRefId(suggestion.id);
    setIsOpen(false);
    publish(suggestion.label, suggestion.id);
    if (Object.keys(suggestion.fields).length > 0) fillRecordFields(suggestion.fields);
  };

  const showSuggestions = isOpen && (suggestions.length > 0 || (canSearchServer && lookup.isFetching));

  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} hasError={isSubmitError} />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          placeholder={placeHolder}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setText(event.target.value);
            setRefId(null);
            setIsOpen(true);
          }}
          // O atraso deixa o toque numa sugestão chegar antes de a lista fechar.
          onBlur={(event) => {
            const typedText = event.target.value;
            setTimeout(() => setIsOpen(false), 150);
            publish(typedText, refId);
          }}
          className={`pl-9 ${isSubmitError ? "border-destructive!" : ""}`}
        />
        {showSuggestions && (
          <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {canSearchServer && lookup.isFetching && suggestions.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Buscando...</li>
            )}
            {suggestions.map((suggestion) => (
              <li key={suggestion.id ?? suggestion.label} role="option" aria-selected={false}>
                <button
                  type="button"
                  // `onMouseDown` evita que o campo perca o foco antes do clique.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(suggestion)}
                  className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="break-words">{suggestion.label}</span>
                  {suggestion.detail && <span className="text-xs text-muted-foreground">{suggestion.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {text.trim().length > 0 && !refId && isServerSource && canSearchServer && !isOpen && (
        <p className="text-[0.8rem] text-muted-foreground">Usando o texto digitado.</p>
      )}
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock, formData } = useBuilderStore();
  const attributes = block.attributes;
  const [inlineText, setInlineText] = useState(attributes.inlineOptions.join("\n"));
  const { forms } = useQueryListForms();

  const commit = (partial: Partial<AttributesType>) => {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, { ...block, attributes: { ...attributes, ...partial } });
  };

  const otherForms = forms.filter((form) => form.id !== formData?.id);

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Busca no Órbita {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Buscar em</Label>
          <Select value={attributes.source} onValueChange={(source) => commit({ source: source as LookupSource })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCE_LABELS).map(([source, sourceLabel]) => (
                <SelectItem key={source} value={source}>
                  {sourceLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {attributes.source === "RECORDS" && (
          <div className="space-y-1">
            <Label className="text-[13px] font-normal">Formulário de origem</Label>
            <Select value={attributes.sourceFormId || undefined} onValueChange={(sourceFormId) => commit({ sourceFormId })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o formulário" />
              </SelectTrigger>
              <SelectContent>
                {otherForms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-tight text-muted-foreground">
              A busca usa os campos marcados como pesquisáveis no formulário de origem. Ao escolher uma ficha, os campos
              deste formulário com o mesmo nome-chave são preenchidos.
            </p>
          </div>
        )}
        {attributes.source === "INLINE" && (
          <div className="space-y-1">
            <Label className="text-[13px] font-normal">Itens da lista ({attributes.inlineOptions.length})</Label>
            <Textarea
              value={inlineText}
              rows={8}
              placeholder={"Um item por linha.\nPode colar uma coluna da planilha."}
              onChange={(event) => setInlineText(event.target.value)}
              onBlur={() => {
                const inlineOptions = parseInlineOptions(inlineText);
                setInlineText(inlineOptions.join("\n"));
                commit({ inlineOptions });
              }}
            />
          </div>
        )}
        {attributes.source !== "INLINE" && (
          <p className="text-[11px] leading-tight text-muted-foreground">
            Só quem está logado na empresa vê as sugestões. Em link público, este campo vira texto comum.
          </p>
        )}
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Texto de exemplo</Label>
          <Input value={attributes.placeHolder} onChange={(event) => commit({ placeHolder: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Obrigatório</Label>
          <Switch checked={attributes.required} onCheckedChange={(required) => commit({ required })} />
        </div>
      </div>
    </div>
  );
}
