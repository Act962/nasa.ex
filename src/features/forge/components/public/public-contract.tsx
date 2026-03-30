"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  Mail,
  MessageCircle,
  PenLine,
  Share2,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Signer {
  name: string;
  email: string;
  token: string;
  signed_at: string | null;
  sign_method?: string;
}

interface Contract {
  id: string;
  number: number;
  value: string;
  startDate: string;
  endDate: string;
  status: string;
  content: string | null;
  signers: Signer[];
  currentSignerToken: string;
  organization: { id: string; name: string; logo: string | null };
  proposal: {
    title: string;
    client: { name: string; email: string | null } | null;
  } | null;
  settings: {
    logoUrl: string | null;
    letterheadHeader: string | null;
    letterheadFooter: string | null;
    proposalBgColor: string;
  } | null;
}

type SignMethod = "manual" | "govbr";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ─── Print running header ─────────────────────────────────────────────────────
// Hidden on screen; position:fixed on every print page via globals.css

function PrintHeader({ logo, orgName, number }: { logo: string | null; orgName: string; number: number }) {
  return (
    <div className="forge-print-header" aria-hidden="true">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {logo && (
          <img src={logo} alt={orgName} style={{ height: "26px", objectFit: "contain", maxWidth: "80px" }} />
        )}
        <span style={{ fontWeight: 700, fontSize: "10pt", color: "#1f2937" }}>{orgName}</span>
      </div>
      <span style={{ fontFamily: "monospace", fontSize: "9pt", color: "#6b7280" }}>
        CONTRATO #{String(number).padStart(4, "0")}
      </span>
    </div>
  );
}

function PrintFooter({ orgName }: { orgName: string }) {
  return (
    <div className="forge-print-footer" aria-hidden="true">
      <span>Assinatura digital — documento com validade jurídica</span>
      <span>{orgName} · FORGE · N.A.S.A®</span>
    </div>
  );
}

// ─── Signers panel ────────────────────────────────────────────────────────────

function SignersPanel({ signers }: { signers: Signer[] }) {
  return (
    <div className="space-y-2">
      {signers.map((s) => (
        <div
          key={s.token}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
            s.signed_at
              ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40"
              : "bg-muted/40 border-border"
          )}
        >
          {s.signed_at ? (
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          ) : (
            <Clock className="size-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium truncate", !s.signed_at && "text-muted-foreground")}>
              {s.name}
            </p>
            {s.email && <p className="text-xs text-muted-foreground truncate">{s.email}</p>}
          </div>
          {s.signed_at ? (
            <div className="text-right shrink-0">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Assinado</p>
              <p className="text-xs text-muted-foreground">{fmtDateTime(s.signed_at)}</p>
              {s.sign_method && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  via {s.sign_method === "govbr" ? "GOV.br" : "Manual"}
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground shrink-0">Aguardando</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Manual signature panel ───────────────────────────────────────────────────

function ManualPanel({
  contractId,
  token,
  defaultName,
  onSigned,
}: {
  contractId: string;
  token: string;
  defaultName: string;
  onSigned: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [fullName, setFullName] = useState(defaultName);
  const [loading, setLoading] = useState(false);

  const canSign = accepted && fullName.trim().length >= 3;

  const handleSign = async () => {
    if (!canSign) return;
    setLoading(true);
    try {
      const res = await fetch("/api/forge/sign-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, token, name: fullName.trim(), method: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      onSigned();
      toast.success("Contrato assinado com sucesso!");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao assinar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Name field */}
      <div className="space-y-1.5">
        <Label htmlFor="sign-name" className="flex items-center gap-1.5">
          <User className="size-3.5" /> Nome completo para assinatura *
        </Label>
        <Input
          id="sign-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Digite seu nome completo"
          className="max-w-md"
          autoComplete="name"
        />
      </div>

      {/* Consent checkbox */}
      <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(!!v)}
          className="mt-0.5"
        />
        <Label
          htmlFor="accept-terms"
          className="text-sm font-normal cursor-pointer leading-relaxed"
        >
          Declaro que li e aceito todos os termos e condições deste contrato, reconhecendo
          esta assinatura eletrônica como{" "}
          <strong>válida e juridicamente vinculante</strong> nos termos da
          Lei n.º 14.063/2020 (Assinatura Eletrônica no Brasil).
        </Label>
      </div>

      {/* Sign button */}
      <Button
        onClick={handleSign}
        disabled={!canSign || loading}
        size="lg"
        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2 w-full sm:w-auto"
      >
        <PenLine className="size-4" />
        {loading ? "Assinando..." : "✍️  Assinar Contrato"}
      </Button>
    </div>
  );
}

// ─── GOV.br signature panel ───────────────────────────────────────────────────

function GovBrPanel({
  contractId,
  token,
  signerName,
  onSigned,
}: {
  contractId: string;
  token: string;
  signerName: string;
  onSigned: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleGovBr = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/forge/sign-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // name kept from existing signer record; method = govbr
        body: JSON.stringify({ contractId, token, name: signerName, method: "govbr" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      onSigned();
      toast.success("Contrato assinado via GOV.br!");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao assinar via GOV.br.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#1351B4]/30 bg-[#1351B4]/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-[#1351B4] flex items-center justify-center shrink-0">
          <ShieldCheck className="size-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm">Assinatura com GOV.br</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Validade jurídica garantida pelo governo federal (ICP-Brasil).
            Nível Prata ou Ouro necessário.
          </p>
        </div>
      </div>

      <Button
        onClick={handleGovBr}
        disabled={loading}
        className="w-full gap-2 font-semibold"
        style={{ backgroundColor: "#1351B4" }}
      >
        <ExternalLink className="size-4" />
        {loading ? "Aguardando autenticação..." : "Entrar com GOV.br e assinar"}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center">
        Você será redirecionado para o portal do Governo Federal
      </p>
    </div>
  );
}

// ─── Sharing bar ──────────────────────────────────────────────────────────────
// contractUrl is derived client-side only (useEffect) to avoid SSR/CSR mismatch.

function SharingBar({
  signerEmail,
  contractTitle,
}: {
  signerEmail: string | null;
  contractTitle: string;
}) {
  // Start empty so server and client render identical HTML; fill after mount.
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.href); }, []);

  const waText = encodeURIComponent(
    `Olá! Segue o link para assinar o contrato "${contractTitle}":\n${url}`
  );
  const mailSubject = encodeURIComponent(`Contrato para assinatura: ${contractTitle}`);
  const mailBody = encodeURIComponent(
    `Olá,\n\nSegue o link para assinar o contrato "${contractTitle}":\n\n${url}\n\nAtenciosamente.`
  );

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="forge-no-print">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
        <Share2 className="size-3.5" /> Compartilhar link de assinatura
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={url ? `https://wa.me/?text=${waText}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
        <a
          href={url ? `mailto:${signerEmail ?? ""}?subject=${mailSubject}&body=${mailBody}` : undefined}
          aria-disabled={!url}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
        >
          <Mail className="size-3.5" /> E-mail
        </a>
        <button
          onClick={handleCopy}
          disabled={!url}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
        >
          <Link2 className="size-3.5" /> Copiar link
        </button>
      </div>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SignedSuccess({ method, signerName }: { method?: string; signerName: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
        <CheckCircle2 className="size-8 text-emerald-500" />
      </div>
      <div>
        <p className="font-bold text-lg">Assinado com sucesso!</p>
        <p className="text-sm text-muted-foreground mt-1">
          {signerName}, sua assinatura foi registrada
          {method === "govbr" ? " via GOV.br" : ""}.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Você receberá uma cópia por e-mail assim que todos assinarem.
        </p>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PublicContractView({ contract }: { contract: Contract }) {
  const currentSigner = contract.signers.find((s) => s.token === contract.currentSignerToken);
  const alreadySigned = !!currentSigner?.signed_at;

  const [signed, setSigned] = useState(alreadySigned);
  const [usedMethod, setUsedMethod] = useState<string | undefined>(currentSigner?.sign_method);
  const [signMethod, setSignMethod] = useState<SignMethod>("manual");

  const logo = contract.settings?.logoUrl ?? contract.organization.logo;
  const contractTitle =
    contract.proposal?.title ?? `Contrato #${String(contract.number).padStart(4, "0")}`;

  // Document title for PDF
  useEffect(() => {
    const prev = document.title;
    const orgSlug = contract.organization.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    document.title = `${orgSlug}_Contrato_${String(contract.number).padStart(4, "0")}`;
    return () => { document.title = prev; };
  }, [contract.organization.name, contract.number]);

  const handleSigned = (method: SignMethod) => {
    setUsedMethod(method);
    setSigned(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-neutral-950 print:bg-white">
      {/* Print running elements */}
      <PrintHeader logo={logo} orgName={contract.organization.name} number={contract.number} />
      <PrintFooter orgName={contract.organization.name} />

      {/* Floating PDF button */}
      <button
        onClick={() => window.print()}
        className="forge-pdf-btn fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xl shadow-purple-900/30 transition-all hover:scale-105 active:scale-95"
      >
        <Download className="size-4" /> Baixar PDF
      </button>

      <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">

        {/* ── Header card ──────────────────────────────────────────────────── */}
        <div className="forge-avoid-break bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Letterhead or default */}
          {contract.settings?.letterheadHeader ? (
            <div
              className="px-8 py-4 border-b"
              dangerouslySetInnerHTML={{ __html: contract.settings.letterheadHeader }}
            />
          ) : (
            <div className="flex items-center gap-4 px-8 py-6 border-b bg-gradient-to-r from-[#7C3AED]/10 to-transparent">
              {logo && <img src={logo} alt="Logo" className="h-12 object-contain" />}
              <p className="font-black text-lg">{contract.organization.name}</p>
            </div>
          )}

          {/* Contract meta */}
          <div className="px-8 py-6 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                  <FileText className="size-3" /> CONTRATO #{String(contract.number).padStart(4, "0")}
                </p>
                <h1 className="text-2xl font-black mt-1 leading-tight">{contractTitle}</h1>
              </div>
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide",
                contract.status === "ATIVO"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : contract.status === "ENCERRADO"
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {contract.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Valor</p>
                <p className="font-bold text-[#7C3AED] text-sm">{fmtBRL(contract.value)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Início</p>
                <p className="font-semibold text-sm">{fmtDate(contract.startDate)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Término</p>
                <p className="font-semibold text-sm">{fmtDate(contract.endDate)}</p>
              </div>
            </div>

            {contract.proposal?.client && (
              <p className="text-sm text-muted-foreground pt-1">
                Parte contratante:{" "}
                <strong className="text-foreground">{contract.proposal.client.name}</strong>
              </p>
            )}
          </div>
        </div>

        {/* ── Contract content ─────────────────────────────────────────────── */}
        {contract.content && (
          <div className="forge-avoid-break bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-border px-8 py-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="size-3.5" /> Termos do Contrato
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {contract.content}
            </div>
          </div>
        )}

        {/* ── Signers status ───────────────────────────────────────────────── */}
        <div className="forge-avoid-break bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-border px-8 py-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <User className="size-3.5" /> Assinantes
          </h2>
          <SignersPanel signers={contract.signers} />
        </div>

        {/* ── Signature action ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-border px-8 py-6 space-y-6">

          {signed ? (
            <SignedSuccess method={usedMethod} signerName={currentSigner?.name ?? ""} />
          ) : alreadySigned ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileCheck2 className="size-10 text-muted-foreground" />
              <p className="font-semibold">Você já assinou este contrato</p>
              <p className="text-sm text-muted-foreground">
                Assinatura registrada em{" "}
                {currentSigner?.signed_at ? fmtDateTime(currentSigner.signed_at) : "—"}
              </p>
            </div>
          ) : (
            <div className="space-y-5 forge-no-print">
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                  <PenLine className="size-3.5" /> Sua Assinatura
                </h2>
                <p className="text-xs text-muted-foreground">
                  Escolha como deseja assinar este contrato
                </p>
              </div>

              {/* Method selector */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSignMethod("manual")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    signMethod === "manual"
                      ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED]"
                      : "border-border text-muted-foreground hover:border-[#7C3AED]/40 hover:text-foreground"
                  )}
                >
                  <PenLine className="size-4" />
                  Assinatura eletrônica
                </button>
                <button
                  type="button"
                  onClick={() => setSignMethod("govbr")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    signMethod === "govbr"
                      ? "border-[#1351B4] bg-[#1351B4]/10 text-[#1351B4]"
                      : "border-border text-muted-foreground hover:border-[#1351B4]/40 hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="size-4" />
                  GOV.br
                </button>
              </div>

              {/* Panel */}
              {signMethod === "manual" ? (
                <ManualPanel
                  contractId={contract.id}
                  token={contract.currentSignerToken}
                  defaultName={currentSigner?.name ?? ""}
                  onSigned={() => handleSigned("manual")}
                />
              ) : (
                <GovBrPanel
                  contractId={contract.id}
                  token={contract.currentSignerToken}
                  signerName={currentSigner?.name ?? ""}
                  onSigned={() => handleSigned("govbr")}
                />
              )}
            </div>
          )}

          {/* Sharing — always visible (screen only) */}
          <div className="border-t pt-5">
            <SharingBar
              signerEmail={contract.proposal?.client?.email ?? null}
              contractTitle={contractTitle}
            />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="forge-avoid-break bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-border overflow-hidden">
          {contract.settings?.letterheadFooter ? (
            <div
              className="px-8 py-4"
              dangerouslySetInnerHTML={{ __html: contract.settings.letterheadFooter }}
            />
          ) : (
            <div className="px-8 py-4 text-xs text-muted-foreground text-center">
              {contract.organization.name} — Assinatura digital via FORGE · N.A.S.A®
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
