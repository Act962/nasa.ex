import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { orpc } from "@/lib/orpc";
import { getQueryClient } from "@/lib/query/hydration";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { useMutation } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SelectEditField } from "./select-edit-field";
import { InputEditField } from "./input-edit-field";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";

export type TypeFieldLead =
  | "email"
  | "phone"
  | "responsible"
  | "street"
  | "city"
  | "country"
  | null;

interface InfoItemProps {
  label: string;
  value: string;
  loading?: boolean;
  type: TypeFieldLead;
  trackingId?: string;
  fieldValue?: string;
}
export function InfoItem({
  label,
  fieldValue,
  value,
  loading,
  type,
  trackingId,
}: InfoItemProps) {
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const { leadId } = useParams<{ leadId: string }>();
  function handleToggle() {
    setIsEditingLead((isEditingLead) => !isEditingLead);
  }

  const mutation = useMutationLeadUpdate(leadId);
  function getValueField() {
    const field = type === "responsible" ? fieldValue : value;
    return field;
  }

  function handleEditField(dataField: string) {
    handleToggle();
    const prev = displayValue;
    setDisplayValue(dataField);
    const payload: Record<string, string> = { id: leadId } as any;
    if (type === "email") payload.email = dataField;
    if (type === "phone") payload.phone = normalizePhone(dataField);
    if (type === "responsible") payload.responsibleId = dataField;

    mutation.mutate(payload as any, {
      onError: () => {
        setDisplayValue(prev);
      },
    });
  }

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <>
      <div className="flex flex-col gap-1 lead">
        {loading && (
          <div className="flex flex-col w-full gap-1">
            <Skeleton className="w-full h-4 rounded-sm" />
            <Skeleton className="w-20 h-4 rounded-sm" />
          </div>
        )}
        {!loading && (
          <div className="flex flex-col gap-1 group">
            <span className="text-xs opacity-60">{label}</span>
            {!isEditingLead ? (
              <div className="flex items-center">
                <Tooltip delayDuration={700}>
                  <TooltipTrigger asChild>
                    <span className="text-xs max-w-45 truncate">
                      {type === "phone" ? phoneMask(value) : getValueField()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getValueField()}</p>
                  </TooltipContent>
                </Tooltip>
                {type && (
                  <Button
                    variant={"ghost"}
                    size={"icon-xs"}
                    className="items-center ml-2 opacity-100 sm:opacity-0 
                    transition-opacity
                    group-hover:opacity-100"
                    onClick={handleToggle}
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                {type === "responsible" ? (
                  <SelectEditField
                    type={type}
                    trackingId={trackingId!}
                    value={displayValue}
                    onSubmit={(value) => handleEditField(value)}
                  />
                ) : (
                  <InputEditField
                    type={type}
                    value={displayValue}
                    onSubmit={(value) => handleEditField(value)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
