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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, CheckCircle2, Lock, Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdding: boolean;
  isMaster: boolean;
  onAdd: (data: {
    email: string;
    name: string;
    role: "owner" | "admin" | "member" | "moderador";
  }) => void;
  createdPassword: string | null;
  resetCreatedPassword: () => void;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  isAdding,
  isMaster,
  onAdd,
  createdPassword,
  resetCreatedPassword,
}: AddMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "member" | "moderador">(
    "member",
  );
  const [copiedPassword, setCopiedPassword] = useState(false);

  const resetForm = () => {
    setEmail("");
    setName("");
    setRole("member");
    setCopiedPassword(false);
    resetCreatedPassword();
  };

  const handleSubmit = () => {
    if (!email || !name) {
      toast.error("Preencha e-mail e nome");
      return;
    }
    onAdd({ email, name, role });
  };

  const handleCopyPassword = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        {!createdPassword ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5" /> Adicionar Usuário
              </DialogTitle>
              <DialogDescription>
                Um novo usuário será criado e adicionado à sua organização.
                Uma senha temporária será gerada automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-name">Nome completo</Label>
                <Input
                  id="add-name"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAdding}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-email">E-mail</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isAdding}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-role">Cargo</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as any)}
                  disabled={isAdding}
                >
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isMaster && (
                      <SelectItem value="owner">Master</SelectItem>
                    )}
                    <SelectItem value="admin">Adm</SelectItem>
                    <SelectItem value="member">Single</SelectItem>
                    <SelectItem value="moderador">Moderador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isAdding}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isAdding || !email || !name}
              >
                {isAdding ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" /> Usuário criado com sucesso!
              </DialogTitle>
              <DialogDescription>
                O usuário <strong>{email}</strong> foi adicionado à organização.
                Compartilhe a senha temporária abaixo com segurança.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">E-mail</span>
                  <span className="text-sm font-medium">{email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Senha temporária
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-bold tracking-widest bg-background px-2 py-0.5 rounded border select-all">
                      {createdPassword}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={handleCopyPassword}
                    >
                      {copiedPassword ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <Lock className="size-3.5 mt-0.5 shrink-0" />O usuário deverá
                alterar a senha após o primeiro acesso por razões de segurança.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
