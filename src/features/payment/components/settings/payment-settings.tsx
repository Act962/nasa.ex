"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Star, MoreHorizontal, Trash2, Tag } from "lucide-react";
import {
  usePaymentCategories,
  useCreatePaymentCategory,
  useDeletePaymentCategory,
} from "../../hooks/use-payment";
import { CATEGORY_TYPE_LABELS } from "../../lib/format";
import { toast } from "sonner";
import { describePaymentError } from "../../lib/describe-error";

function CategoriesSection() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [catType, setCatType] = useState<"REVENUE" | "EXPENSE" | "COST">("EXPENSE");
  const [color, setColor] = useState("#1E90FF");

  const { data } = usePaymentCategories();
  const create = useCreatePaymentCategory();
  const remove = useDeletePaymentCategory();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    try {
      await create.mutateAsync({ name, type: catType, color });
      setShowForm(false); setName(""); setColor("#1E90FF");
      toast.success("Categoria criada!");
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível criar a categoria"));
    }
  }

  const grouped = {
    REVENUE: data?.categories.filter(c => c.type === "REVENUE") ?? [],
    EXPENSE: data?.categories.filter(c => c.type === "EXPENSE") ?? [],
    COST: data?.categories.filter(c => c.type === "COST") ?? [],
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Tag className="size-4 text-purple-400" /> Categorias
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(true)} className="gap-1 text-xs h-7">
          <Plus className="size-3" /> Adicionar
        </Button>
      </div>

      {(Object.entries(grouped) as [string, typeof grouped.REVENUE][]).map(([type, cats]) => cats.length > 0 && (
        <div key={type}>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">{CATEGORY_TYPE_LABELS[type]}</p>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/40 bg-muted/30 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: c.color ?? "#1E90FF" }} />
                {c.name}
                <button onClick={() => remove.mutate({ id: c.id })} className="ml-0.5 text-muted-foreground hover:text-red-400 transition-colors">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input placeholder="Ex: Serviços" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={catType} onValueChange={(v) => setCatType(v as typeof catType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer border border-border" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={create.isPending} className="flex-1 bg-[#1E90FF] text-white">{create.isPending ? "..." : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentSettings() {
  return (
    <CategoriesSection />
  );
}
