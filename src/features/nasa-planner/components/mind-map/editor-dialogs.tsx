"use client";

import { useState } from "react";
import { BotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCard } from "../../hooks/use-nasa-planner";

/** Janelas do editor de mapa mental: novo card de ação e sugestões da IA. */

const CARD_PRIORITIES = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
] as const;

type CardPriority = (typeof CARD_PRIORITIES)[number]["value"];

interface CardForm {
  title: string;
  description: string;
  priority: CardPriority;
  dueDate: string;
}

const EMPTY_CARD_FORM: CardForm = { title: "", description: "", priority: "MEDIUM", dueDate: "" };

const isCardPriority = (value: string): value is CardPriority =>
  CARD_PRIORITIES.some((priority) => priority.value === value);

interface ActionCardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  plannerId: string;
  mindMapId: string;
}

export function ActionCardDialog({ isOpen, onOpenChange, plannerId, mindMapId }: ActionCardDialogProps) {
  const createCard = useCreateCard();
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD_FORM);

  const handleCreate = async () => {
    if (!cardForm.title.trim()) return;
    await createCard.mutateAsync({
      mindMapId,
      plannerId,
      title: cardForm.title,
      description: cardForm.description,
      priority: cardForm.priority,
      dueDate: cardForm.dueDate || undefined,
    });
    onOpenChange(false);
    setCardForm(EMPTY_CARD_FORM);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Card de Ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              placeholder="O que precisa ser feito?"
              value={cardForm.title}
              onChange={(event) => setCardForm((form) => ({ ...form, title: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              placeholder="Detalhes..."
              value={cardForm.description}
              onChange={(event) => setCardForm((form) => ({ ...form, description: event.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={cardForm.priority}
                onValueChange={(value) => {
                  if (isCardPriority(value)) setCardForm((form) => ({ ...form, priority: value }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARD_PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data limite</Label>
              <Input
                type="date"
                value={cardForm.dueDate}
                onChange={(event) => setCardForm((form) => ({ ...form, dueDate: event.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!cardForm.title.trim() || createCard.isPending}>
            {createCard.isPending ? "Criando..." : "Criar Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface AiSuggestionRequest {
  nodeId: string;
  label: string;
  suggestions: string[];
}

interface AiSuggestionsDialogProps {
  request: AiSuggestionRequest | null;
  onApply: (nodeId: string, suggestions: string[]) => void;
  onClose: () => void;
}

export function AiSuggestionsDialog({ request, onApply, onClose }: AiSuggestionsDialogProps) {
  if (!request) return null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotIcon className="size-4 text-warning" />
            Sugestões de IA para “{request.label}”
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Selecione as sugestões que deseja adicionar como filhos:</p>
          <ul className="space-y-1.5">
            {request.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted/50">
                <span className="size-5 rounded-full bg-warning/15 text-warning flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onApply(request.nodeId, request.suggestions)}>
            Adicionar todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
