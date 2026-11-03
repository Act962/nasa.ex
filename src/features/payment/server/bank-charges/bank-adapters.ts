import "server-only";
import { interBankAdapter } from "./inter-adapter";
import type { BankAdapter, BankChargeProviderName } from "./ports";

// Registro dos bancos com API. Segundo banco: escreva o adapter e acrescente aqui (e no enum
// `PaymentBankProvider` do schema e em `lib/bank-providers.ts`, para a tela).

const BANK_ADAPTERS: Record<BankChargeProviderName, BankAdapter> = {
  INTER: interBankAdapter,
};

export function getBankAdapter(provider: BankChargeProviderName): BankAdapter {
  return BANK_ADAPTERS[provider];
}
