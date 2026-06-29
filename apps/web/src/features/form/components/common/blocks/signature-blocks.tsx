import { useEffect, useRef, useState } from "react";
import { ChevronDown, PenLine, Signature, Eraser } from "lucide-react";
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
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { TagDropdown } from "./dropdown-select-tag";
import { Tag as TagIcon, Lock, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  // Tag aplicada ao lead quando o responsável assina (SignatureUser).
  // Lida pelo `submitResponse` via `meta.tagId`. Ignorada em SignatureClient.
  tagId?: string | null;
  // Membro da org pré-cadastrado como ÚNICO autorizado a assinar este campo.
  // Quando definido:
  //   - apenas esse user pode clicar em "Assinar"
  //   - o campo vira um gate: o botão "Próximo" trava até a assinatura
  //   - tentativa de assinatura por outro user mostra toast de não autorizado
  // O `assigneeName` é cache pra exibir na UI mesmo quando o user logado
  // não é membro (ou ainda não recebeu a lista de membros).
  assigneeUserId?: string | null;
  assigneeName?: string | null;
};

const propertiesValidateSchema = z.object({
  label: z.string().trim().max(255).optional(),
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
  propertiesComponent: PropertiesView("Assinatura responsável", {
    withTag: true,
    withAssignee: true,
  }),
};

function SignatureUserCanvas({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  return (
    <div className="flex flex-col gap-2 w-full">
      {label?.trim() && (

        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">

          {label}

          {required && <span className="text-red-500"> *</span>}

        </Label>

      )}
      <Button type="button" variant="outline" className="w-fit pointer-events-none">
        <Signature className="w-4 h-4 mr-2" />
        Assinar como responsável
      </Button>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
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
  const { label, required, helperText, assigneeUserId, assigneeName } =
    block.attributes;
  const session = authClient.useSession();
  const user = session.data?.user;
  // Identidade autorizada: se `assigneeUserId` está configurado, só esse
  // user pode assinar. Sem assignee (=null), qualquer user logado assina.
  const hasAssigneeGate = !!assigneeUserId;
  const isAuthorized = !hasAssigneeGate || user?.id === assigneeUserId;

  // Prefill: a assinatura salva tem `meta.signedAt` + dados do user que
  // assinou (que pode ser diferente do user logado atual).
  const prefill = usePrefillFieldValue(block.id);
  const prefillMeta = (prefill?.meta ?? {}) as {
    userId?: string;
    name?: string;
    email?: string;
    signedAt?: string;
  };
  const [signedAt, setSignedAt] = useState<string | null>(
    prefillMeta.signedAt ?? null,
  );
  // Quem assinou (pode ser o user logado ou outro consultor anteriormente).
  const [signerName, setSignerName] = useState<string | null>(
    prefillMeta.name ?? null,
  );
  const [isError, setIsError] = useState(false);

  // Sincroniza o prefill com o formVals no mount (se tiver).
  useEffect(() => {
    if (prefill?.value && handleBlur) {
      handleBlur(block.id, prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sign() {
    if (!user) return;
    if (!isAuthorized) {
      toast.error("Você não é autorizado a assinar esse campo.");
      return;
    }
    const at = new Date().toISOString();
    setSignedAt(at);
    setSignerName(user.name);
    setIsError(false);
    handleBlur?.(block.id, {
      value: `${user.name} — ${at}`,
      meta: {
        userId: user.id,
        name: user.name,
        email: user.email,
        signedAt: at,
        // Tag configurada no Properties — lida pelo submitResponse
        // (`field?.meta?.tagId`) e aplicada ao lead automaticamente.
        tagId: block.attributes.tagId ?? null,
        // Marca de gate cumprido — útil pra auditoria.
        assigneeUserId: assigneeUserId ?? null,
      },
    });
  }

  function unsign() {
    setSignedAt(null);
    setSignerName(null);
    if (required) setIsError(true);
    handleBlur?.(block.id, { value: "" });
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label
        className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {/* Quando há um responsável pré-cadastrado, exibe um aviso visual
          em todos os estados (assinado/não-assinado). Faz duplo papel:
          comunica o gate pra todos e ajuda quem NÃO é autorizado a
          entender por que o botão "Próximo" está travado. */}
      {hasAssigneeGate && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs">
          <Lock className="size-3.5 shrink-0" />
          <span>
            Apenas <strong>{assigneeName ?? "o responsável designado"}</strong>{" "}
            pode assinar este campo.
          </span>
        </div>
      )}

      {signedAt ? (
        // Já assinado (na sessão atual ou na anterior — vinda do prefill).
        // Exibe quem assinou (signerName) — pode ser o user logado ou outro
        // consultor que tinha assinado em uma versão anterior da resposta.
        <div className="flex items-center justify-between border rounded-md p-3 bg-emerald-500/10">
          <div className="text-sm">
            <p className="font-medium">{signerName ?? user?.name ?? "Assinado"}</p>
            <p className="text-xs text-muted-foreground">
              Assinado em {new Date(signedAt).toLocaleString("pt-BR")}
            </p>
          </div>
          {isAuthorized && (
            <Button type="button" variant="ghost" size="sm" onClick={unsign}>
              <Eraser className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">
          Faça login para assinar como responsável.
        </p>
      ) : isAuthorized ? (
        <Button type="button" onClick={sign} className="w-fit">
          <Signature className="w-4 h-4 mr-2" />
          Assinar como {user.name}
        </Button>
      ) : (
        // User logado não é o autorizado — botão visível mas que apenas
        // mostra a mensagem de erro ao clicar (em vez de ficar disabled
        // sem feedback nenhum).
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            toast.error("Você não é autorizado a assinar esse campo.")
          }
        >
          <Lock className="w-4 h-4 mr-2" />
          Aguardando {assigneeName ?? "responsável"}
        </Button>
      )}
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Assinatura obrigatória."}</p>
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
      {label?.trim() && (

        <Label className="text-base font-normal! mb-2 whitespace-normal break-words leading-snug">

          {label}

          {required && <span className="text-red-500"> *</span>}

        </Label>

      )}
      <div className="border-2 border-dashed rounded-md h-32 flex items-center justify-center text-sm text-muted-foreground">
        <PenLine className="w-5 h-5 mr-2" />
        Área para o cliente assinar
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
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

  // Drawing usa REF (não useState) pra evitar stale-closure: após o
  // `mousedown`, o `mousemove` pode disparar antes do React rerender,
  // e a closure antiga via useState retornaria `drawing=false` perdendo
  // os primeiros traços.
  const drawingRef = useRef(false);
  // Throttle do save: capturamos o dataURL a cada `frame` durante o desenho
  // (não só no `end`), pra não perder a assinatura se o evento de release
  // não disparar (touchcancel, drag fora da viewport, etc.).
  const saveScheduledRef = useRef(false);

  // Prefill: assinatura salva como dataURL (PNG) em `value` (e em `meta.dataUrl`).
  // Vamos redesenhar no canvas assim que ele tiver dimensões válidas.
  const prefill = usePrefillFieldValue(block.id);
  const prefillDataUrl =
    prefill?.value && prefill.value.startsWith("data:image")
      ? prefill.value
      : ((prefill?.meta as { dataUrl?: string } | undefined)?.dataUrl ?? null);
  const [hasContent, setHasContent] = useState(!!prefillDataUrl);
  const [isError, setIsError] = useState(false);

  // Helper: serializa o canvas e propaga o handleBlur. Usado pelo `end()` E
  // pelo throttle de mid-stroke. Evita reprocessamento se o canvas estiver
  // efetivamente vazio (mantém a assinatura prévia, se houver).
  function persistSignature() {
    const c = canvasRef.current;
    if (!c) return;
    if (c.width === 0 || c.height === 0) return; // canvas escondido
    const dataUrl = c.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 200) return; // png praticamente vazio
    setIsError(false);
    handleBlur?.(block.id, {
      value: dataUrl,
      meta: { dataUrl, signedAt: new Date().toISOString() },
    });
  }

  // Sincroniza com o formVals no mount (mantém os bytes salvos disponíveis
  // pro próximo save mesmo se o user não tocar no canvas).
  useEffect(() => {
    if (prefillDataUrl && handleBlur) {
      handleBlur(block.id, {
        value: prefillDataUrl,
        meta: {
          dataUrl: prefillDataUrl,
          signedAt:
            ((prefill?.meta as { signedAt?: string } | undefined)?.signedAt) ??
            new Date().toISOString(),
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    drawingRef.current = true;
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    if (!hasContent) setHasContent(true);

    // Save throttled durante o desenho — garante que a assinatura é salva
    // mesmo se `end()` não disparar (touchcancel, mouseup fora do canvas
    // sem mouseleave, etc.). Usamos requestAnimationFrame pra não fazer
    // toDataURL em todo evento de move (caro).
    if (!saveScheduledRef.current) {
      saveScheduledRef.current = true;
      requestAnimationFrame(() => {
        saveScheduledRef.current = false;
        if (drawingRef.current) persistSignature();
      });
    }
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    persistSignature();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    if (required) setIsError(true);
    handleBlur?.(block.id, { value: "" });
  }

  // Em modo passo-a-passo, todos os blocos ficam montados com `display:none`
  // — então `offsetWidth/Height` é 0 quando o canvas está escondido. Usamos
  // ResizeObserver pra remensurar quando o passo aparece (e também em
  // resizes da janela). Sem isso, a assinatura grava em coordenadas (0,0)
  // e o usuário não consegue desenhar nada visível.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Flag pra desenhar o prefill apenas no primeiro resize válido, evitando
    // sobrescrever traços novos do user em remeasures subsequentes.
    let prefillDrawn = false;

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      if (w === 0 || h === 0) return; // ainda escondido (display:none)
      // Captura o desenho atual pra reaplicar após o resize. Na primeira
      // medida, se houver `prefillDataUrl`, usa esse em vez do toDataURL
      // (que retornaria canvas vazio antes do primeiro paint).
      const prev =
        !prefillDrawn && prefillDataUrl
          ? prefillDataUrl
          : w === c.width && h === c.height
            ? null
            : c.toDataURL();
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (ctx && prev && prev.length > 100) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
        img.src = prev;
      }
      prefillDrawn = true;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    // `data-allow-interaction`: marca o bloco como interativo mesmo dentro
    // de um form em modo read-only (cliente final visualizando). O CSS do
    // wrapper (em form-submit-component) usa esse atributo pra escapar
    // do `pointer-events: none` global.
    <div className="flex flex-col gap-2 w-full" data-allow-interaction>
      <Label
        className={`text-base font-normal! mb-2 whitespace-normal break-words leading-snug ${isError || isSubmitError ? "text-red-500" : ""}`}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div
        className={`relative border-2 rounded-md bg-white ${
          isError || isSubmitError ? "border-red-500!" : "border-foreground/20"
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
          onTouchCancel={end}
          onPointerLeave={end}
        />
        {!hasContent && (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            Assine aqui
          </span>
        )}
        {hasContent && (
          <span className="absolute top-1.5 right-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 pointer-events-none">
            ✓ capturada
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={clear}>
          <Eraser className="w-4 h-4 mr-1" />
          Limpar
        </Button>
        {hasContent && (
          <span className="text-[11px] text-muted-foreground">
            Assinatura salva no formulário
          </span>
        )}
      </div>
      {helperText && <p className="text-[0.8rem] text-muted-foreground break-words whitespace-normal">{helperText}</p>}
      {(isError || isSubmitError) && (
        <p className="text-red-500 text-[0.8rem] break-words whitespace-normal">{errorMessage || "Assinatura obrigatória."}</p>
      )}
    </div>
  );
}

// ============== shared properties view ==============

function PropertiesView(
  headerLabel: string,
  opts: { withTag?: boolean; withAssignee?: boolean } = {},
) {
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

    // Membros da org pra picker do "Responsável autorizado a assinar".
    // Só carrega quando o block precisa (SignatureUser).
    const { data: membersData } = useQuery({
      ...orpc.orgs.listMembers.queryOptions({
        input: { query: { userIds: undefined } },
      }),
      retry: false,
      enabled: !!opts.withAssignee,
    });
    const members = membersData?.members ?? [];

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

            {/*
              Tag (mesma mecânica do RadioSelect): quando o responsável
              assinar, o `meta.tagId` é capturado pelo `submitResponse` e
              aplicado ao lead automaticamente. Ex.: tag "Ficha assinada"
              é colada ao lead assim que o consultor clica em "Assinar".
            */}
            {opts.withTag && (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel className="text-[13px] font-normal">
                    Tag aplicada ao assinar
                  </FormLabel>
                  <TagDropdown
                    tagId={block.attributes.tagId ?? null}
                    onSelect={(tagId) => commit({ tagId })}
                  >
                    <TagIcon className="text-muted-foreground size-4" />
                  </TagDropdown>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Quando o responsável assinar, esta tag é aplicada ao lead.
                </p>
              </FormItem>
            )}

            {opts.withAssignee && (
              <FormItem>
                <FormLabel className="text-[13px] font-normal">
                  Responsável autorizado a assinar
                </FormLabel>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal"
                    >
                      {block.attributes.assigneeName ? (
                        <>
                          <UserCircle className="size-4 mr-2 shrink-0" />
                          <span className="truncate">
                            {block.attributes.assigneeName}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserCircle className="size-4 mr-2 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Qualquer usuário logado
                          </span>
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 max-h-72 overflow-auto"
                  >
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Quem pode assinar
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        commit({ assigneeUserId: null, assigneeName: null })
                      }
                    >
                      <UserCircle className="size-4 mr-2 text-muted-foreground" />
                      <span>Qualquer usuário logado</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {members.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">
                        Nenhum membro carregado.
                      </div>
                    ) : (
                      members.map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          onSelect={() =>
                            commit({
                              assigneeUserId: m.id,
                              assigneeName: m.name ?? m.email ?? "Membro",
                            })
                          }
                        >
                          <Avatar className="size-5 mr-2">
                            {m.image && <AvatarImage src={m.image} />}
                            <AvatarFallback className="text-[10px]">
                              {m.name?.[0] ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{m.name ?? m.email}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-[11px] text-muted-foreground">
                  Quando definido, o campo vira um gate: apenas esse usuário
                  pode assinar e o botão "Próximo" trava até a assinatura.
                </p>
              </FormItem>
            )}
          </form>
        </Form>
      </div>
    );
  };
}
