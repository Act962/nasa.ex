"use client";

import { useLostOrWin } from "@/hooks/use-lost-or-win";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select-studio";
import { Label } from "../ui/label";
import { InputGroup, InputGroupTextarea } from "../ui/input-group";
import { Button } from "../ui/button";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../ui/field";
import { useEffect } from "react";

const schemaLostOrWinner = z.object({
  observation: z.string().optional(),
  reasons: z.string().min(1, "Campo obrigatório"),
});
export function LostOrWinModal() {
  const { id, isOpen, onClose, type } = useLostOrWin();

  const form = useForm({
    resolver: zodResolver(schemaLostOrWinner),
    defaultValues: {
      observation: "",
      reasons: "",
    },
  });

  const isLost = type === "LOST";

  const reasonsLost = [
    { id: 1, reason: "Preço acima do orçamento disponível pelo cliente" },
    { id: 2, reason: "Cliente optou por um concorrente" },
    { id: 3, reason: "Falta de retorno ou follow-up no tempo esperado" },
    {
      id: 4,
      reason:
        "Não houve alinhamento entre a solução e a necessidade do cliente",
    },
    { id: 5, reason: "Cliente desistiu do projeto ou adiou indefinidamente" },
    { id: 6, reason: "Problemas de confiança ou credibilidade da empresa" },
    { id: 7, reason: "Decisor não foi envolvido no processo de negociação" },
    { id: 8, reason: "Condições comerciais ou de pagamento não foram viáveis" },
    {
      id: 9,
      reason: "Lead estava apenas pesquisando, sem intenção real de compra",
    },
    {
      id: 10,
      reason:
        "Mudança interna no cliente (prioridades, orçamento ou estratégia)",
    },
  ];

  const onSubmit = () => {
    console.log(form.getValues());
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [onClose, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isLost ? "Lead Perdido" : "Lead Ganho"}</DialogTitle>
          <DialogDescription>
            <span className="text-sm">
              {isLost ? "Não foi dessa vez" : "Parabéns você conseguiu"}
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="popoverLost">
              Motivo de {isLost ? "Perda" : "Ganho"}
            </Label>
            <Controller
              name="reasons"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full " id="popoverLost">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {reasonsLost.map((reason) => (
                        <SelectItem key={reason.id} value={reason.reason}>
                          {reason.reason}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.reasons && (
              <FieldError>{form.formState.errors.reasons.message}</FieldError>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="textAreaPopover">Observações</Label>
            <InputGroup>
              <InputGroupTextarea
                className="resize-none break-all max-h-24"
                id="textAreaPopover"
                placeholder={`Descreva o motivo ${isLost ? "da perda" : "do ganho"}`}
                {...form.register("observation")}
              />
            </InputGroup>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
