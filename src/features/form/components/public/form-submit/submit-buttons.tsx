"use client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SubmitButtonsProps = {
  showLeadFields: boolean;
  isLoading: boolean;
  onBack: () => void;
  onSubmit: () => void;
  textColor?: string;
  primaryColor?: string;
  primaryBtnStyle: React.CSSProperties;
  submitLabel?: string;
};

export function SubmitButtons({
  showLeadFields,
  isLoading,
  onBack,
  onSubmit,
  textColor,
  primaryColor,
  primaryBtnStyle,
  submitLabel,
}: SubmitButtonsProps) {
  return (
    <div className="w-full max-w-[80%] mx-auto flex flex-col-reverse xl:flex-row justify-between gap-3 xl:gap-4">
      {showLeadFields && (
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
      )}
      <Button
        data-form-submit
        className={showLeadFields ? "w-full xl:flex-1" : "w-full"}
        disabled={isLoading}
        style={primaryBtnStyle}
        onClick={onSubmit}
      >
        {isLoading && <Spinner className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel ?? "Enviar"}
      </Button>
    </div>
  );
}
