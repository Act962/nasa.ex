"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { usePlannerPost } from "../../hooks/use-planner-calendar";
import { usePlannerWeekdayThemes } from "../../hooks/use-planner-weekly-script";
import { useCreatePlannerClientPost, useDeletePlannerPostV2, useUpdatePlannerPostV2 } from "../../hooks/use-planner-planning";
import { ComposerScriptStep, type ScriptStepValues } from "./composer-script-step";
import { ComposerCreationStep } from "./composer-creation-step";
import { ComposerScheduleStep } from "./composer-schedule-step";
import { ReviewPanel } from "./review-panel";
import { POST_TYPE_META } from "./planner-v2-utils";
import type { ComposerRequest, PlannerClient } from "./planner-v2-types";

/** Criador do Planner v2 (spec 0058, RF-10): Roteiro → Criação → Revisão → Programação. Gaveta de baixo no celular. */

type ComposerStep = "script" | "creation" | "review" | "schedule";

const STEPS: Array<{ value: ComposerStep; label: string }> = [
  { value: "script", label: "Roteiro" },
  { value: "creation", label: "Criação" },
  { value: "review", label: "Revisão" },
  { value: "schedule", label: "Programação" },
];

function stepForStatus(status: string): ComposerStep {
  if (status === "PENDING_APPROVAL" || status === "CHANGES_REQUESTED") return "review";
  if (["APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"].includes(status)) return "schedule";
  return "creation";
}

function ComposerBody({ request, clients, onClose }: { request: ComposerRequest; clients: PlannerClient[]; onClose: () => void }) {
  const [postId, setPostId] = useState<string | null>(request.mode === "edit" ? request.postId : null);
  const [chosenStep, setChosenStep] = useState<ComposerStep | null>(request.mode === "create" ? "script" : null);
  const { post, permissions, isLoading } = usePlannerPost(postId);
  const { themes: weekdayThemes } = usePlannerWeekdayThemes();
  const createPost = useCreatePlannerClientPost();
  const updatePost = useUpdatePlannerPostV2();
  const deletePost = useDeletePlannerPostV2();
  const step = chosenStep ?? (post ? stepForStatus(post.status) : "script");
  const intendedAt = request.mode === "create" ? request.intendedAt : undefined;

  if (postId && (isLoading || !post || !permissions)) {
    return (
      <div className="grid h-80 place-items-center">
        <DialogTitle className="sr-only">Carregando conteúdo</DialogTitle>
        <OrbitaSpinner className="size-6" />
      </div>
    );
  }

  const firstClientId = clients.find((client) => client.permissions.canCreate)?.id ?? "";
  const initialOrganizationId = (request.mode === "create" && request.organizationId) || firstClientId;
  // Post novo já nasce com o tema fixo do dia da semana como objetivo (spec 0067).
  const defaultObjective = intendedAt ? (weekdayThemes.find((theme) => theme.organizationId === initialOrganizationId && theme.weekday === intendedAt.getDay())?.theme ?? "") : "";
  const scriptInitialValues: ScriptStepValues = post
    ? {
        organizationId: post.organizationId,
        type: post.type,
        title: post.title ?? "",
        script: post.script ?? "",
        objective: post.objective ?? "",
        cta: post.cta ?? "",
        pillarId: post.pillarId,
        targetNetworks: post.targetNetworks.filter((network): network is "INSTAGRAM" | "FACEBOOK" => network === "INSTAGRAM" || network === "FACEBOOK"),
        targetIgAccountId: post.targetIgAccountId,
        targetFbPageId: post.targetFbPageId,
        formats: [post.type],
        generatedByFormat: {},
      }
    : {
        organizationId: initialOrganizationId,
        type: request.mode === "create" ? request.type : "STATIC",
        title: (request.mode === "create" && request.title) || "",
        script: "",
        objective: defaultObjective,
        cta: "",
        pillarId: null,
        targetNetworks: ["INSTAGRAM"],
        targetIgAccountId: null,
        targetFbPageId: null,
        formats: [request.mode === "create" ? request.type : "STATIC"],
        generatedByFormat: {},
      };

  const saveScript = (values: ScriptStepValues) => {
    const sharedFields = {
      type: values.type,
      title: values.title || undefined,
      script: values.script || undefined,
      objective: values.objective || undefined,
      cta: values.cta || undefined,
      pillarId: values.pillarId ?? undefined,
      targetNetworks: values.targetNetworks,
      targetIgAccountId: values.targetIgAccountId ?? undefined,
      targetFbPageId: values.targetFbPageId ?? undefined,
    };
    if (post) {
      updatePost.mutate({ postId: post.id, ...sharedFields }, { onSuccess: () => setChosenStep("creation"), onError: (error) => toast.error(error.message) });
      return;
    }
    // Vários formatos (spec 0063, RF-4): cada um vira um rascunho; o primeiro segue aberto no criador.
    const [primaryFormat, ...extraFormats] = values.formats.length ? values.formats : [values.type];
    const draftFieldsFor = (format: typeof primaryFormat) => {
      const generated = values.generatedByFormat[format];
      return format === primaryFormat
        ? { caption: generated?.caption || undefined, hashtags: generated?.hashtags }
        : { title: generated?.title || values.title || undefined, script: generated?.script || undefined, caption: generated?.caption || undefined, hashtags: generated?.hashtags };
    };
    createPost.mutate(
      {
        organizationId: values.organizationId,
        ...sharedFields,
        type: primaryFormat,
        ...draftFieldsFor(primaryFormat),
        intendedAt,
        momentKey: request.mode === "create" ? request.momentKey : undefined,
      },
      {
        onSuccess: async ({ post: createdPost }) => {
          for (const format of extraFormats) {
            await createPost
              .mutateAsync({ organizationId: values.organizationId, ...sharedFields, type: format, ...draftFieldsFor(format), intendedAt })
              .catch((error: Error) => toast.error(error.message || `Não deu para criar o ${POST_TYPE_META[format].label}.`));
          }
          if (extraFormats.length > 0) toast.success(`${extraFormats.length + 1} rascunhos criados. Os outros estão em Rascunhos.`);
          setPostId(createdPost.id);
          setChosenStep("creation");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerPostCreated });
        },
        onError: (error) => toast.error(error.message || "Não deu para criar o post."),
      },
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line py-3 pr-14 pl-4">
        <DialogTitle className="mr-auto truncate text-base font-bold">
          {post ? post.title || POST_TYPE_META[post.type].label : "Novo conteúdo"}
        </DialogTitle>
        {post && permissions?.canEdit && post.status !== "PUBLISHING" && (
          <button
            type="button"
            aria-label="Excluir post"
            onClick={() => deletePost.mutate({ postId: post.id }, { onSuccess: onClose, onError: (error) => toast.error(error.message) })}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <nav className="scroll-hidden-x flex gap-1.5 overflow-x-auto px-4 py-3">
        {STEPS.map((stepOption, stepIndex) => {
          const isDone = STEPS.findIndex((candidate) => candidate.value === step) > stepIndex;
          return (
            <button
              key={stepOption.value}
              type="button"
              disabled={!post && stepOption.value !== "script"}
              onClick={() => setChosenStep(stepOption.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm disabled:opacity-40",
                step === stepOption.value ? "bg-panel font-semibold" : "text-muted-foreground",
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded-full bg-panel text-[11px]", isDone && "bg-success text-background")}>
                {isDone ? <Check className="size-3" /> : stepIndex + 1}
              </span>
              {stepOption.label}
            </button>
          );
        })}
      </nav>
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto sm:max-h-[70vh]">
        {step === "script" && (
          <ComposerScriptStep
            clients={clients}
            initialValues={scriptInitialValues}
            isClientLocked={Boolean(post)}
            isCreating={!post}
            isSaving={createPost.isPending || updatePost.isPending}
            submitLabel={post ? "Salvar e continuar" : "Criar e continuar"}
            onSubmit={saveScript}
          />
        )}
        {step === "creation" && post && permissions && (
          <ComposerCreationStep post={post} canEdit={permissions.canEdit} onContinue={() => setChosenStep("review")} />
        )}
        {step === "review" && post && permissions && (
          <ReviewPanel post={post} permissions={permissions} onApproved={() => setChosenStep("schedule")} />
        )}
        {step === "schedule" && post && permissions && (
          <ComposerScheduleStep post={post} canSchedule={permissions.canSchedule} initialDate={intendedAt} />
        )}
      </div>
    </>
  );
}

export function PostComposer({ request, clients, onClose }: { request: ComposerRequest | null; clients: PlannerClient[]; onClose: () => void }) {
  return (
    <Dialog open={Boolean(request)} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="gap-0 sm:max-w-4xl overflow-hidden p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 sm:rounded-[22px]">
        {request && (
          <ComposerBody
            key={request.mode === "edit" ? request.postId : `create-${request.type}-${request.intendedAt?.toISOString() ?? ""}`}
            request={request}
            clients={clients}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
