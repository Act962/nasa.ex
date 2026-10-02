"use client";

import { useState } from "react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateAccountingAccount, useUpdateAccountingAccount } from "@/features/accounting/hooks/use-accounting-ledger";
import {
  resolveParentCode,
  type AccountingNatureCode,
} from "@/features/accounting/lib/chart-of-accounts/default-chart";
import { ACCOUNT_CODE_PATTERN, NATURE_DESCRIPTIONS, toErrorMessage } from "./account-code";

export interface ChartAccountRow {
  id: string;
  code: string;
  name: string;
  nature: AccountingNatureCode;
  parentId: string | null;
  isAnalytical: boolean;
  systemKey: string | null;
  referentialCode: string | null;
  isActive: boolean;
}

const NATURE_OPTIONS = Object.keys(NATURE_DESCRIPTIONS) as AccountingNatureCode[];

interface NewAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ChartAccountRow[];
}

export function NewAccountDialog({ open, onOpenChange, accounts }: NewAccountDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [chosenNature, setChosenNature] = useState<AccountingNatureCode | null>(null);
  const [isAnalytical, setIsAnalytical] = useState(true);
  const createAccount = useCreateAccountingAccount();

  const trimmedCode = code.trim();
  const isCodeFormatValid = ACCOUNT_CODE_PATTERN.test(trimmedCode);
  const isDuplicate = accounts.some((account) => account.code === trimmedCode);
  const parentCode = isCodeFormatValid ? resolveParentCode(trimmedCode) : null;
  const parentAccount = parentCode ? accounts.find((account) => account.code === parentCode) : undefined;
  const nature: AccountingNatureCode = chosenNature ?? parentAccount?.nature ?? "EXPENSE";

  const codeError = !trimmedCode
    ? null
    : !isCodeFormatValid
      ? "Use só números separados por ponto, ex.: 4.1.01.010"
      : isDuplicate
        ? "Já existe uma conta com esse código."
        : null;
  const canSubmit = isCodeFormatValid && !isDuplicate && name.trim().length >= 2 && !createAccount.isPending;

  function resetForm() {
    setCode("");
    setName("");
    setChosenNature(null);
    setIsAnalytical(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    createAccount.mutate(
      { code: trimmedCode, name: name.trim(), nature, isAnalytical },
      {
        onSuccess: () => {
          toast.success("Conta criada.");
          resetForm();
          onOpenChange(false);
        },
        onError: (error) => toast.error(toErrorMessage(error, "Não foi possível criar a conta.")),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>
              O código define onde a conta fica na árvore: 4.1.01.010 fica dentro de 4.1.01.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-account-code">Código</Label>
            <Input
              id="new-account-code"
              inputMode="decimal"
              placeholder="4.1.01.010"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d.]/g, ""))}
              aria-invalid={Boolean(codeError)}
            />
            {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            {!codeError && parentAccount && (
              <p className="text-xs text-muted-foreground">
                Fica dentro de <span className="font-medium">{parentAccount.code} · {parentAccount.name}</span>
              </p>
            )}
            {!codeError && parentCode && !parentAccount && (
              <p className="text-xs text-warning dark:text-warning">
                A conta {parentCode} ainda não existe: esta conta vai ficar no primeiro nível da árvore.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-account-name">Nome</Label>
            <Input id="new-account-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-account-nature">Natureza</Label>
            <Select value={nature} onValueChange={(selected) => setChosenNature(selected as AccountingNatureCode)}>
              <SelectTrigger id="new-account-nature" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURE_OPTIONS.map((natureOption) => (
                  <SelectItem key={natureOption} value={natureOption}>
                    {NATURE_DESCRIPTIONS[natureOption]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="new-account-analytical">Recebe lançamentos (analítica)</Label>
              <p className="text-xs text-muted-foreground">
                Desligue para criar um grupo (sintética) que só soma as contas de dentro.
              </p>
            </div>
            <Switch id="new-account-analytical" checked={isAnalytical} onCheckedChange={setIsAnalytical} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-info text-white hover:bg-info">
              {createAccount.isPending && <OrbitaSpinner className="size-4 " />}
              Criar conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditAccountDialogProps {
  account: ChartAccountRow | null;
  onOpenChange: (open: boolean) => void;
}

export function EditAccountDialog({ account, onOpenChange }: EditAccountDialogProps) {
  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {account && <EditAccountForm key={account.id} account={account} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditAccountForm({ account, onClose }: { account: ChartAccountRow; onClose: () => void }) {
  const [name, setName] = useState(account.name);
  const [isActive, setIsActive] = useState(account.isActive);
  const updateAccount = useUpdateAccountingAccount();
  const isSystemAccount = account.systemKey !== null;
  const canSubmit = name.trim().length >= 2 && !updateAccount.isPending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    updateAccount.mutate(
      { accountId: account.id, name: name.trim(), isActive },
      {
        onSuccess: () => {
          toast.success("Conta atualizada.");
          onClose();
        },
        onError: (error) => toast.error(toErrorMessage(error, "Não foi possível salvar a conta.")),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Editar conta {account.code}</DialogTitle>
        <DialogDescription>O código e a natureza não mudam para não bagunçar o que já foi lançado.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="edit-account-name">Nome</Label>
        <Input id="edit-account-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div className="space-y-0.5">
          <Label htmlFor="edit-account-active">Conta ativa</Label>
          <p className="text-xs text-muted-foreground">
            {isSystemAccount
              ? "Esta conta é usada pelo sistema para contabilizar sozinho — por isso não pode ser desativada."
              : "Conta inativa some das opções de mapeamento, mas o histórico continua."}
          </p>
        </div>
        <Switch id="edit-account-active" checked={isActive} disabled={isSystemAccount} onCheckedChange={setIsActive} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit} className="gap-1.5 bg-info text-white hover:bg-info">
          {updateAccount.isPending && <OrbitaSpinner className="size-4 " />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
