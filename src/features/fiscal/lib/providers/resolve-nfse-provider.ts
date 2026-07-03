import type { FiscalInvoiceType } from "@/generated/prisma/enums";
import { municipalNfseProvider } from "./municipal-nfse-provider";
import { nacionalNfseProvider } from "./nacional-nfse-provider";
import type { NfseProvider, NfseStandard } from "./nfse-provider";

export function resolveNfseProvider(standard: NfseStandard): NfseProvider {
  return standard === "NACIONAL" ? nacionalNfseProvider : municipalNfseProvider;
}

export function resolveNfseProviderByInvoiceType(
  invoiceType: FiscalInvoiceType,
): NfseProvider {
  return invoiceType === "NFSE_NACIONAL"
    ? nacionalNfseProvider
    : municipalNfseProvider;
}
