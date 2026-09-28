import "server-only";

import prisma from "@/lib/prisma";
import type { NormalizedStatement } from "./ports";

// Qual conta cadastrada recebe o extrato, e quando o extrato é de outra conta.
// No OFX o ACCTID é comparado byte a byte; no PDF o número vem lido por IA e
// com ou sem agência/dígito, então a comparação é por dígitos e por sufixo.

export type AccountMatchReason = "EXACT_ACCOUNT" | "BANK_CODE" | "ONLY_ACCOUNT" | "NONE";

const MIN_ACCOUNT_DIGITS_FOR_SUFFIX_MATCH = 4;

function bareBankCode(value: string): string {
  return String(Number(value.replace(/\D/g, "")));
}

function isSameAccountNumberLoosely(left: string, right: string): boolean {
  const leftDigits = left.replace(/\D/g, "").replace(/^0+/, "");
  const rightDigits = right.replace(/\D/g, "").replace(/^0+/, "");
  if (!leftDigits || !rightDigits) return false;
  if (leftDigits === rightDigits) return true;
  const shorter = leftDigits.length <= rightDigits.length ? leftDigits : rightDigits;
  const longer = shorter === leftDigits ? rightDigits : leftDigits;
  return shorter.length >= MIN_ACCOUNT_DIGITS_FOR_SUFFIX_MATCH && longer.endsWith(shorter);
}

type StatementAccountIdentity = Pick<NormalizedStatement, "accountId" | "source">;

function isSameStatementAccount(statement: StatementAccountIdentity, ofxAccountId: string): boolean {
  if (!statement.accountId) return false;
  if (statement.source === "PDF_UPLOAD") {
    return isSameAccountNumberLoosely(statement.accountId, ofxAccountId);
  }
  return statement.accountId === ofxAccountId;
}

/** Mensagem de recusa quando o extrato declara outra conta, ou `null` se pode importar. */
export function describeStatementAccountMismatch(
  statement: StatementAccountIdentity,
  account: { name: string; ofxAccountId: string | null },
): string | null {
  if (!statement.accountId || !account.ofxAccountId) return null;
  if (isSameStatementAccount(statement, account.ofxAccountId)) return null;
  return `Este extrato é da conta ${statement.accountId}, mas "${account.name}" está vinculada à conta ${account.ofxAccountId}.`;
}

export async function suggestStatementAccount(params: {
  organizationId: string;
  statement: NormalizedStatement;
}): Promise<{ suggestedAccountId: string | null; matchReason: AccountMatchReason }> {
  const { statement } = params;
  const accounts = await prisma.paymentBankAccount.findMany({
    where: { organizationId: params.organizationId, isActive: true },
    select: { id: true, ofxAccountId: true, bankCode: true },
  });

  // Da pista mais forte para a mais fraca: a conta que já recebeu extrato
  // desta mesma conta bancária, depois a que declara o mesmo banco, e por
  // fim — só quando existe uma única conta cadastrada — ela mesma.
  const accountByNumber = statement.accountId
    ? accounts.find((account) => account.ofxAccountId && isSameStatementAccount(statement, account.ofxAccountId))
    : undefined;

  const statementBankDigits = statement.bankId ? bareBankCode(statement.bankId) : null;
  const accountsByBank = statementBankDigits
    ? accounts.filter((account) => account.bankCode && bareBankCode(account.bankCode) === statementBankDigits)
    : [];

  if (accountByNumber) return { suggestedAccountId: accountByNumber.id, matchReason: "EXACT_ACCOUNT" };
  // Só sugere por banco quando há uma única candidata: com duas contas no
  // mesmo banco, apontar uma seria adivinhação.
  if (accountsByBank.length === 1) return { suggestedAccountId: accountsByBank[0].id, matchReason: "BANK_CODE" };
  if (accounts.length === 1 && accountsByBank.length === 0) {
    return { suggestedAccountId: accounts[0].id, matchReason: "ONLY_ACCOUNT" };
  }
  return { suggestedAccountId: null, matchReason: "NONE" };
}
