import { useEffect, useState } from "react";
import {
  ChevronDown,
  DownloadIcon,
  EyeIcon,
  FileUp,
  FileText,
  Trash,
} from "lucide-react";
import { ImagePreviewDialog } from "@/features/actions/components/view-modal/image-preview-dialog";
import { handleDownload, handleOpen } from "@/utils/handle-files";
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
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "FileUpload";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  multiple: boolean;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
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
      {label?.trim() && (

        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">

          {label}

          {required && <span className="text-red-500"> *</span>}

        </Label>

      )}
      <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
        <FileUp className="w-5 h-5 mx-auto mb-1" />
        Arraste arquivos aqui ou clique para enviar
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
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

  // Prefill: extrai a lista de arquivos salva. Preferimos `meta.files`
  // (que tem `name` original); cai pra split do `value` (CSV de URLs S3).
  const prefill = usePrefillFieldValue(block.id);
  const initialFiles: FileItem[] = (() => {
    if (!prefill) return [];
    const metaFiles = (prefill.meta as { files?: unknown } | undefined)?.files;
    if (Array.isArray(metaFiles)) {
      return metaFiles
        .filter((f): f is FileItem =>
          !!f &&
          typeof f === "object" &&
          typeof (f as { url?: unknown }).url === "string",
        )
        .map((f) => ({
          url: (f as { url: string }).url,
          name: (f as { name?: string }).name ?? "Arquivo",
        }));
    }
    if (typeof prefill.value === "string" && prefill.value.length > 0) {
      return prefill.value
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url, name: url.split("/").pop() ?? "Arquivo" }));
    }
    return [];
  })();
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [isError, setIsError] = useState(false);
  const [uploaderEpoch, setUploaderEpoch] = useState(0);

  // Propaga o prefill pro formVals no mount (evita perda de dados se o user
  // só clicar em Salvar sem mexer nos arquivos).
  useEffect(() => {
    if (initialFiles.length > 0 && handleBlur) {
      handleBlur(block.id, {
        value: initialFiles.map((f) => f.url).join(","),
        meta: { files: initialFiles },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (multiple) setUploaderEpoch((e) => e + 1);
  }

  function remove(idx: number) {
    commit(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (
        <Label className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      {(multiple || files.length === 0) && (
        <Uploader
          key={`uploader-${uploaderEpoch}`}
          fileTypeAccepted="outros"
          onUpload={onUpload}
        />
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {files.map((f, idx) => (
            <FilePreview key={`${f.url}-${idx}`} file={f} onRemove={() => remove(idx)} />
          ))}
        </div>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Envie um arquivo."}</p>
      )}
    </div>
  );
}

const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);
function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(name.split(".").pop()?.toLowerCase() ?? "");
}

function FilePreview({ file, onRemove }: { file: FileItem; onRemove: () => void }) {
  const url = useConstructUrl(file.url);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isImage = isImageFile(file.name);

  function onView() {
    if (isImage) setPreviewOpen(true);
    else handleOpen(url);
  }

  return (
    <>
      <div className="flex items-center justify-between p-2 border rounded-md gap-2">
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">{file.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onView}
            title={isImage ? "Visualizar" : "Abrir em nova aba"}
          >
            <EyeIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleDownload(url, file.name)}
            title="Baixar"
          >
            <DownloadIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            title="Remover"
          >
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isImage && (
        <ImagePreviewDialog
          open={previewOpen}
          src={url}
          fileName={file.name}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => handleDownload(url, file.name)}
        />
      )}
    </>
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
