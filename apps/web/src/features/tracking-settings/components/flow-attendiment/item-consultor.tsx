"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpRightIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch-variable";
import { useState } from "react";
import { toast } from "sonner";
import { useUpdateTrackingConsultant } from "../../hooks/use-tracking-consultants";
import { ModalDeleteConsultor } from "./modal-delete-consultor";

interface ItemConsultorProps {
  consultant: {
    name: string;
    image: string | null;
  };
  maxFlow: number;
  currentFlow: number;
  trackingId: string;
  isActive: boolean;
  consultantId: string;
}

export function ItemConsultor({
  currentFlow,
  maxFlow,
  consultant,
  trackingId,
  isActive,
  consultantId,
}: ItemConsultorProps) {
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
  const mutation = useUpdateTrackingConsultant();
  const [isEditing, setIsEditing] = useState(false);
  const [flowValue, setFlowValue] = useState(maxFlow);

  const toggleActive = () => {
    mutation.mutate({
      id: consultantId,
      isActive: !isActive,
    });
  };

  const onchangeFlowValue = (value: number) => {
    mutation.mutate(
      {
        id: consultantId,
        maxFlow: value,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Erro ao atualizar fluxo do consultor.");
          setFlowValue(maxFlow);
        },
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={consultant.image || undefined} />
              <AvatarFallback>
                {consultant.name
                  ?.split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{consultant.name}</span>
          </CardTitle>
          <CardAction className="space-x-3">
            <Switch checked={isActive} onCheckedChange={toggleActive} />
            <Button
              size={"icon-sm"}
              onClick={() => setModalDeleteOpen(true)}
              variant={"destructive"}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Total atendido por vez:</span>

              {isEditing ? (
                <input
                  disabled={mutation.isPending}
                  type="number"
                  value={flowValue}
                  onChange={(e) => setFlowValue(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onchangeFlowValue(flowValue);
                    }
                  }}
                  className="w-16 px-2 py-1 border rounded text-sm"
                  autoFocus
                />
              ) : (
                <>
                  <span>{flowValue}</span>
                  <Button
                    onClick={() => setIsEditing(true)}
                    size={"icon-xs"}
                    variant={"ghost"}
                  >
                    <PencilIcon className="size-3" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-x-2">
              <span>Atendendo agora: {currentFlow}</span>
              <ArrowUpRightIcon className="size-3" />
            </div>
          </div>
        </CardContent>
      </Card>
      <ModalDeleteConsultor
        isOpen={modalDeleteOpen}
        onOpenChange={setModalDeleteOpen}
        consultant={{ ...consultant, id: consultantId }}
        trackingId={trackingId}
      />
    </>
  );
}
