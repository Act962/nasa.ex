import { useEffect, useState } from "react";
import { ChevronDown, FileUp, FileText, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "FileUpload";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  multiple: boolean;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
  multiple: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

export const FileUploadBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: { label: "Anexo", helperText: "", required: false, multiple: false } satisfies AttributesType,
  }),
  blockBtnElement: { icon: FileUp, label: "Upload arquivo" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

type Instance = FormBlockInstance & { attributes: AttributesType };
type FileItem = { url: string; name: string };

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
        <FileUp className="w-5 h-5 mx-auto mb-1" />
        Arraste arquivos aqui ou clique para enviar
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
  errorMessage,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
  errorMessage?: string;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText, multiple } = block.attributes;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isError, setIsError] = useState(false);

  function commit(next: FileItem[]) {
    setFiles(next);
    const isValid = !required || next.length > 0;
    setIsError(!isValid);
    handleBlur?.(block.id, {
      value: next.map((f) => f.url).join(","),
      meta: { files: next },
    });
  }

  function onUpload(key: string, fileName?: string) {
    const item = { url: key, name: fileName ?? "Arquivo" };
    commit(multiple ? [...files, item] : [item]);
  }

  function remove(idx: number) {
    commit(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {(multiple || files.length === 0) && (
        <Uploader fileTypeAccepted="outros" onUpload={onUpload} />
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {files.map((f, idx) => (
            <FilePreview key={`${f.url}-${idx}`} file={f} onRemove={() => remove(idx)} />
          ))}
        </div>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem]">{errorMessage || "Envie um arquivo."}</p>
      )}
    </div>
  );
}

function FilePreview({ file, onRemove }: { file: FileItem; onRemove: () => void }) {
  const url = useConstructUrl(file.url);
  return (
    <div className="flex items-center justify-between p-2 border rounded-md">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-sm hover:underline"
      >
        <FileText className="w-4 h-4" />
        {file.name}
      </a>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <Trash className="w-4 h-4" />
      </Button>
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
          Upload arquivo {positionIndex}
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
            name="multiple"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">Permite múltiplos arquivos</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={(v) => { field.onChange(v); commit({ multiple: v }); }} />
                  </FormControl>
                </div>
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
