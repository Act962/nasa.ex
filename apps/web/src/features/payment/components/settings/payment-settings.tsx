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
import { Badge } from "@/components/ui/badge";
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
import { Plus, Star, Landmark, MoreHorizontal, Trash2, Tag } from "lucide-react";
import {
  usePaymentAccounts,
  useCreatePaymentAccount,
  useDeletePaymentAccount,
  usePaymentCategories,
  useCreatePaymentCategory,
  useDeletePaymentCategory,
} from "../../hooks/use-payment";
import { ACCOUNT_TYPE_LABELS, CATEGORY_TYPE_LABELS, formatCurrency } from "../../lib/format";
import { toast } from "sonner";

function AccountsSection() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [type, setType] = useState<"CHECKING" | "SAVINGS" | "CASH" | "DIGITAL">("CHECKING");
  const [balance, setBalance] = useState("");

  const { data } = usePaymentAccounts();
  const create = useCreatePaymentAccount();
  const remove = useDeletePaymentAccount();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");
    const balanceCents = Math.round(parseFloat(balance.replace(",", ".")) * 100) || 0;
    try {
      await create.mutateAsync({ name, bankName: bankName || undefined, type, balance: balanceCents });
      setShowForm(false); setName(""); setBankName(""); setBalance("");
      toast.success("Conta criada!");
    } catch {
      toast.error("Erro ao criar conta");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="size-4 text-blue-400" /> Contas Bancárias
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(true)} className="gap-1 text-xs h-7">
          <Plus className="size-3" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {data?.accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: a.color ?? "#1E90FF" }} />
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[a.type]} {a.bankName ? `• ${a.bankName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${a.balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(a.balance)}
              </span>
              {a.isDefault && <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">Padrão</Badge>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6"><MoreHorizontal className="size-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => remove.mutate({ id: a.id })} className="gap-2 text-red-400">
                    <Trash2 className="size-3" /> Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {!data?.accounts.length && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conta cadastrada</p>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Conta Bancária</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input placeholder="Ex: Conta Principal" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Banco</Label><Input placeholder="Ex: Itaú" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Saldo inicial (R$)</Label><Input placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
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
    } catch {
      toast.error("Erro ao criar categoria");
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
    <div className="space-y-8">
      <AccountsSection />
      <div className="border-t border-border/30" />
      <CategoriesSection />
    </div>
  );
}
