"use client";
import { useEffect, useState } from "react";
import { FormBlockInstance, FieldValue, HandleBlurFunc } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import {
  getCurrentMascot,
  resolveProgressMascots,
} from "@/features/form/lib/progress-mascots";
import { isFillableBlock } from "@/features/form/lib/fillable-blocks";
import { FormSettings } from "@/generated/prisma/client";
import type { FormSettingsTyped } from "@/features/form/types";
import { toast } from "sonner";
import { ProgressMascotIcon } from "./progress-mascot-icon";
import { SubmitButtons } from "./submit-buttons";

type StepBlocksProps = {
  blocks: FormBlockInstance[];
  settings?: FormSettings | FormSettingsTyped | null;
  handleBlur: HandleBlurFunc;
  formErrors: Record<string, string>;
  isLoading: boolean;
  textColor?: string;
  primaryColor?: string;
  primaryBtnStyle: React.CSSProperties;
  showLeadFields: boolean;
  formValsRef: React.MutableRefObject<Record<string, FieldValue>>;
  onBack: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  onStepAdvance?: () => Promise<void> | void;
};

export function StepBlocks({
  blocks,
  settings,
  handleBlur,
  formErrors,
  isLoading,
  textColor,
  primaryColor,
  primaryBtnStyle,
  showLeadFields,
  formValsRef,
  onBack,
  onSubmit,
  submitLabel,
  onStepAdvance,
}: StepBlocksProps) {
  const stepMode = ((settings as unknown as { stepMode?: string })?.stepMode ??
    "off") as "off" | "auto" | "manual";
  const nextLabel =
    (settings as unknown as { nextButtonLabel?: string })?.nextButtonLabel ||
    "Próximo";

  const [currentStep, setCurrentStep] = useState(0);
  const [tick, setTick] = useState(0);

  const wrappedHandleBlur: HandleBlurFunc = (key, value) => {
    handleBlur(key, value);
    setTick((previousTick) => previousTick + 1);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollContainer = document.querySelector(
      "[data-form-scroll-container]",
    ) as HTMLElement | null;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  void tick;

  const allFillableChildren = blocks
    .flatMap((block) => block.childblocks ?? [])
    .filter((child) =>
      isFillableBlock(child.blockType, FormBlocks[child.blockType]?.blockCategory),
    );
  const totalFields = allFillableChildren.length;
  const filledFields = allFillableChildren.filter((child) => {
    const fieldValue = formValsRef.current?.[child.id]?.value?.trim();
    return Boolean(fieldValue);
  }).length;
  const progressPct =
    totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  const mascots = resolveProgressMascots(
    (settings as unknown as { progressMascots?: unknown })?.progressMascots,
  );
  const currentMascot = getCurrentMascot(mascots, progressPct);

  const ProgressHeader = (
    <div className="w-full max-w-[80%] mx-auto flex flex-col gap-1.5 px-1 xl:flex-row xl:items-center xl:justify-between xl:gap-3">
      <span className="text-[11px] xl:text-xs text-muted-foreground/80 shrink-0">
        {stepMode === "off"
          ? `${filledFields} de ${totalFields} campos`
          : `Passo ${currentStep + 1} de ${blocks.length}`}
      </span>
      <div className="flex items-center gap-2 flex-1 w-full xl:max-w-[60%]">
        <div className="relative h-1.5 flex-1 rounded-full bg-foreground/10 overflow-visible">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${progressPct}%`,
              backgroundColor: primaryColor || "hsl(var(--primary))",
            }}
          />
          <ProgressMascotIcon mascot={currentMascot} progressPct={progressPct} />
        </div>
        <span
          className="text-[11px] font-medium tabular-nums shrink-0"
          style={{ color: textColor || undefined }}
          title={`${filledFields} de ${totalFields} campos preenchidos`}
        >
          {progressPct}%
        </span>
      </div>
    </div>
  );

  if (stepMode === "off") {
    return (
      <>
        {ProgressHeader}
        {blocks.map((block) => {
          const BlockFormComponent = FormBlocks[block.blockType].formComponent;
          return (
            <BlockFormComponent
              key={block.id}
              blockInstance={block}
              handleBlur={wrappedHandleBlur}
              formErrors={formErrors}
              settings={settings}
            />
          );
        })}
        <SubmitButtons
          showLeadFields={showLeadFields}
          isLoading={isLoading}
          onBack={onBack}
          onSubmit={onSubmit}
          textColor={textColor}
          primaryColor={primaryColor}
          primaryBtnStyle={primaryBtnStyle}
          submitLabel={submitLabel}
        />
      </>
    );
  }

  const isGroupComplete = (group: FormBlockInstance) => {
    const children = group.childblocks ?? [];
    if (children.length === 0) return true;
    for (const child of children) {
      if (
        !isFillableBlock(
          child.blockType,
          FormBlocks[child.blockType]?.blockCategory,
        )
      )
        continue;

      const isSignatureGate =
        child.blockType === "SignatureUser" && !!child.attributes?.assigneeUserId;

      const required = child.attributes?.required || isSignatureGate;
      if (!required) continue;
      const fieldValue = formValsRef.current?.[child.id]?.value?.trim();
      if (!fieldValue) return false;
    }
    return true;
  };

  const markGroupReached = (groupId: string | undefined) => {
    if (!groupId) return;
    const existing = formValsRef.current["__groupsReached"] as
      | { meta?: { groups?: string[] } }
      | undefined;
    const previous = Array.isArray(existing?.meta?.groups)
      ? existing!.meta!.groups
      : [];
    if (previous.includes(groupId)) return;
    formValsRef.current["__groupsReached"] = {
      value: "",
      meta: { groups: [...previous, groupId] },
    };
  };

  if (
    stepMode === "auto" &&
    currentStep < blocks.length - 1 &&
    isGroupComplete(blocks[currentStep])
  ) {
    setTimeout(() => {
      markGroupReached(blocks[currentStep + 1]?.id);
      onStepAdvance?.();
      setCurrentStep((step) => Math.min(step + 1, blocks.length - 1));
    }, 0);
  }

  const currentBlock = blocks[currentStep];
  const isLastStep = currentStep === blocks.length - 1;
  const canAdvance = isGroupComplete(currentBlock);

  if (!currentBlock) return null;

  return (
    <>
      {ProgressHeader}
      {blocks.map((block, index) => {
        const BlockFormComponent = FormBlocks[block.blockType].formComponent;
        const isVisible = index === currentStep;
        return (
          <div
            key={block.id}
            style={{ display: isVisible ? undefined : "none" }}
            aria-hidden={!isVisible}
          >
            <BlockFormComponent
              blockInstance={block}
              handleBlur={wrappedHandleBlur}
              formErrors={formErrors}
              settings={settings}
            />
          </div>
        );
      })}

      <div className="w-full max-w-[80%] mx-auto flex flex-col-reverse xl:flex-row justify-between gap-3 xl:gap-4">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            className="w-full xl:w-auto bg-transparent border-primary/20"
            style={{
              color: textColor || undefined,
              borderColor: primaryColor || undefined,
            }}
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
          >
            Voltar
          </Button>
        ) : (
          showLeadFields && (
            <Button
              variant="outline"
              className="w-full xl:w-auto bg-transparent border-primary/20"
              style={{
                color: textColor || undefined,
                borderColor: primaryColor || undefined,
              }}
              onClick={onBack}
            >
              Voltar
            </Button>
          )
        )}

        {isLastStep ? (
          <Button
            data-form-submit
            className="w-full xl:flex-1"
            disabled={isLoading}
            style={primaryBtnStyle}
            onClick={onSubmit}
          >
            {isLoading && <Spinner className="w-4 h-4 mr-2 animate-spin" />}
            {submitLabel ?? "Enviar"}
          </Button>
        ) : (
          stepMode === "manual" && (
            <Button
              className="w-full xl:flex-1"
              aria-disabled={!canAdvance}
              style={{
                ...primaryBtnStyle,
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? undefined : "not-allowed",
              }}
              onClick={() => {
                if (canAdvance) {
                  markGroupReached(blocks[currentStep + 1]?.id);
                  onStepAdvance?.();
                  setCurrentStep((step) => Math.min(step + 1, blocks.length - 1));
                  return;
                }
                const signatureGate = (currentBlock.childblocks ?? []).find(
                  (child) => {
                    if (child.blockType !== "SignatureUser") return false;
                    if (!child.attributes?.assigneeUserId) return false;
                    const fieldValue = formValsRef.current?.[child.id]?.value?.trim();
                    return !fieldValue;
                  },
                );
                if (signatureGate) {
                  toast.error(
                    `Você não é autorizado a assinar esse campo. Aguardando ${
                      (signatureGate.attributes as { assigneeName?: string })
                        ?.assigneeName ?? "o responsável"
                    }.`,
                  );
                }
              }}
            >
              {nextLabel}
            </Button>
          )
        )}
      </div>
    </>
  );
}
