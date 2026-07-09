// Barrel do gateway fiscal: importar este módulo registra os adapters
// (side-effect) e expõe factory + tipos. Handlers importam SEMPRE daqui.

import "./adapters/focus-nfe/gateway";
import "./adapters/nfe-io/gateway";

export {
  registerGateway,
  resolveGateway,
  resolveGatewayForInvoice,
  UnknownGatewayError,
} from "./factory";
export {
  focusStatusToDb,
  nfeIoFlowStatusToDb,
  nfeIoWebhookEventToFlowStatus,
} from "./status-mapping";
export { FiscalGatewayValidationError } from "./types";
export type {
  CertificateUpload,
  CompanyProfileDraft,
  CompanyProfilePatch,
  CompanySyncInput,
  CompanySyncResult,
  FiscalGatewayAdapter,
  FiscalIssueOverrides,
  FiscalWebhookEvent,
  InvoiceFileResult,
  InvoiceLocator,
  InvoiceSnapshot,
  IssueInvoiceParams,
  IssueInvoiceResult,
  PreflightResult,
} from "./types";
