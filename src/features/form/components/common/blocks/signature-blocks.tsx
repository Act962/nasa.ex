import { useEffect, useRef, useState } from "react";
import { ChevronDown, PenLine, Signature, Eraser, Check } from "lucide-react";
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
import { authClient } from "@/lib/auth-client";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().min(2).max(255),
  helperText: z.string().trim().max(255).optional(),
  required: z.boolean().default(false).optional(),
});
type PropertiesType = z.input<typeof propertiesValidateSchema>;

type Instance = FormBlockInstance & { attributes: AttributesType };

// ============== USER SIGNATURE (responsável logado, 1 clique) ==============

const userBlockType: FormBlockType = "SignatureUser";
const userBlockCategory: FormCategoryType = "Field";

export const SignatureUserBlock: ObjectBlockType = {
  blockType: userBlockType,
  blockCategory: userBlockCategory,
  createInstance: (id) => ({
    id,
    blockType: userBlockType,
    attributes: {
      label: "Assinatura do responsável",
      helperText: "",
      required: false,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: Signature, label: "Assinatura responsável" },
  canvasComponent: SignatureUserCanvas,
  formComponent: SignatureUserForm,
  propertiesComponent: PropertiesView("Assinatura responsável"),
};

function SignatureUserCanvas({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Button type="button" variant="outline" className="w-fit pointer-events-none">
        <Signature className="w-4 h-4 mr-2" />
        Assinar como responsável
      </Button>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function SignatureUserForm({
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
  const { label, required, helperText } = block.attributes;
  const session = authClient.useSession();
  const user = session.data?.user;
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function sign() {
    if (!user) return;
    const at = new Date().toISOString();
    setSignedAt(at);
    setIsError(false);
    handleBlur?.(block.id, {
      value: `${user.name} — ${at}`,
      meta: { userId: user.id, name: user.name, email: user.email, signedAt: at },
    });
  }

  function unsign() {
    setSignedAt(null);
    if (required) setIsError(true);
    handleBlur?.(block.id, { value: "" });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {!user ? (
        <p className="text-sm text-muted-foreground">
          Faça login para assinar como responsável.
        </p>
      ) : !signedAt ? (
        <Button type="button" onClick={sign} className="w-fit">
          <Signature className="w-4 h-4 mr-2" />
          Assinar como {user.name}
        </Button>
      ) : (
        <div className="flex items-center justify-between border rounded-md p-3 bg-emerald-500/10">
          <div className="text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              Assinado em {new Date(signedAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={unsign}>
            <Eraser className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem]">{errorMessage || "Assinatura obrigatória."}</p>
      )}
    </div>
  );
}

// ============== CLIENT SIGNATURE (canvas) ==============

const clientBlockType: FormBlockType = "SignatureClient";
const clientBlockCategory: FormCategoryType = "Field";

export const SignatureClientBlock: ObjectBlockType = {
  blockType: clientBlockType,
  blockCategory: clientBlockCategory,
  createInstance: (id) => ({
    id,
    blockType: clientBlockType,
    attributes: {
      label: "Assinatura do cliente",
      helperText: "Desenhe sua assinatura no quadro",
      required: false,
    } satisfies AttributesType,
  }),
  blockBtnElement: { icon: PenLine, label: "Assinatura cliente" },
  canvasComponent: SignatureClientCanvasView,
  formComponent: SignatureClientForm,
  propertiesComponent: PropertiesView("Assinatura cliente"),
};

function SignatureClientCanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-base font-normal! mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="border-2 border-dashed rounded-md h-32 flex items-center justify-center text-sm text-muted-foreground">
        <PenLine className="w-5 h-5 mr-2" />
        Área para o cliente assinar
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function SignatureClientForm({
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
  const { label, required, helperText } = block.attributes;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Backup persistente da imagem em sessionStorage por blockId — sobrevive
  // re-renders/remount enquanto a aba estiver aberta. Antes esse valor
  // morria no useState/canvas e a assinatura sumia ao salvar.
  const storageKey = `nasa.form.signature.${block.id}`;
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isError, setIsError] = useState(false);
  // Mantemos o último dataURL fora do React pra garantir que o "Confirmar"
  // pegue mesmo se o paint terminar entre re-renders.
  const lastDataUrlRef = useRef<string>("");

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    // Qualquer novo traço descondirma assinatura antiga — força reconfirmar
    if (confirmed) setConfirmed(false);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasContent(true);
  }

  function end() {
    setDrawing(false);
    // Captura snapshot leve a cada stroke pra ter "última versão" garantida.
    // Mesmo se drawing já estava false (race entre re-renders), salvamos
    // se o canvas tiver conteúdo visível.
    const canvas = canvasRef.current;
    if (!canvas) return;
    // JPEG quality 0.6 reduz ~10x vs PNG sem prejuízo visual da assinatura.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    if (dataUrl && hasContent) {
      lastDataUrlRef.current = dataUrl;
      try {
        sessionStorage.setItem(storageKey, dataUrl);
      } catch {
        /* quota ou modo privado — silenciar */
      }
    }
  }

  function confirm() {
    // Botão "Confirmar assinatura" → grava no formVals via handleBlur.
    // Pega o dataURL atual do canvas (ou do ref) pra evitar perda de
    // estado em re-renders entre o último stroke e o click.
    const canvas = canvasRef.current;
    let dataUrl = lastDataUrlRef.current;
    if (canvas && hasContent) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      lastDataUrlRef.current = dataUrl;
    }
    if (!dataUrl) {
      if (required) setIsError(true);
      return;
    }
    setIsError(false);
    setConfirmed(true);
    try {
      sessionStorage.setItem(storageKey, dataUrl);
    } catch {
      /* ignore */
    }
    handleBlur?.(block.id, {
      value: dataUrl,
      meta: { dataUrl, signedAt: new Date().toISOString() },
    });
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    setConfirmed(false);
    lastDataUrlRef.current = "";
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    if (required) setIsError(true);
    handleBlur?.(block.id, { value: "" });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    // Restaura assinatura prévia (sessionStorage) caso o componente seja
    // remontado durante a sessão — multi-step do form, troca de página etc.
    let saved = "";
    try {
      saved = sessionStorage.getItem(storageKey) ?? "";
    } catch {
      /* ignore */
    }
    if (saved) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasContent(true);
        setConfirmed(true);
        lastDataUrlRef.current = saved;
        // Re-emite pro formVals.current pra não depender da ordem de mount.
        handleBlur?.(block.id, {
          value: saved,
          meta: { dataUrl: saved, restored: true },
        });
      };
      img.src = saved;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div
        className={`relative border-2 rounded-md bg-white ${
          isError || isSubmitError ? "border-red-500!" : confirmed ? "border-emerald-500" : "border-foreground/20"
        }`}
        style={{ height: "150px" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasContent && (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            Assine aqui
          </span>
        )}
        {confirmed && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Check className="w-3 h-3" />
            Assinatura registrada
          </div>
        )}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          type="button"
          size="sm"
          onClick={confirm}
          disabled={!hasContent || confirmed}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Check className="w-4 h-4 mr-1" />
          {confirmed ? "Assinada" : "Confirmar assinatura"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasContent}>
          <Eraser className="w-4 h-4 mr-1" />
          Limpar
        </Button>
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground">{helperText}</p>}
      {!confirmed && hasContent && (
        <p className="text-[0.75rem] text-amber-600">
          Clique em &quot;Confirmar assinatura&quot; pra gravar antes de enviar o formulário.
        </p>
      )}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem]">{errorMessage || "Assinatura obrigatória."}</p>
      )}
    </div>
  );
}

// ============== shared properties view ==============

function PropertiesView(headerLabel: string) {
  return function PropertiesComponent({
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
  };
}
