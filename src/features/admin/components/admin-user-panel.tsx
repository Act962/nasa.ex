"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  X,
  ShieldCheck,
  Power,
  Star,
  Zap,
  CreditCard,
  Building2,
  Save,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan { id: string; name: string; monthlyStars: number; priceMonthly: number }
interface OrgMembership {
  memberId: string; orgId: string; orgName: string; orgLogo: string | null;
  role: string; cargo: string | null;
  starsBalance: number; planId: string | null; planName: string | null;
  spacePoints: number; spaceLevelName: string | null; spaceLevelEmoji: string | null;
}
interface AdminUserPanelProps {
  userId: string; name: string; email: string; image: string | null;
  nickname: string | null; isSystemAdmin: boolean; isActive: boolean;
  createdAt: string; isSelf: boolean;
  orgs: OrgMembership[]; plans: Plan[];
}

const ROLE_LABELS: Record<string, string> = { owner: "Master", admin: "Adm", member: "Single", moderador: "Moderador" };

// ─── Avatar Editor ─────────────────────────────────────────────────────────────
function AvatarEditor({ userId, currentImage, name }: { userId: string; currentImage: string | null; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "U";
  const display = preview ?? currentImage;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, isImage: true }),
      });
      if (!res.ok) throw new Error();
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const publicUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
      await orpc.admin.updateUser.call({ userId, image: publicUrl });
      toast.success("Foto atualizada!");
      setPreview(null); setFile(null);
      qc.invalidateQueries();
    } catch { toast.error("Erro ao enviar foto"); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div
          className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-line cursor-pointer group-hover:ring-info transition-all"
          onClick={() => !uploading && inputRef.current?.click()}
        >
          {display
            ? <Image src={display} alt={name} fill className="object-cover" unoptimized />
            : <div className="w-full h-full bg-info/15 flex items-center justify-center text-3xl font-bold text-info">{initials}</div>
          }
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </div>

      {preview && (
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={uploading} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            {uploading ? <OrbitaSpinner className="w-3 h-3 " /> : <Check className="w-3 h-3" />}
            {uploading ? "Enviando..." : "Salvar foto"}
          </button>
          <button onClick={() => { setPreview(null); setFile(null); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-knob rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {!preview && (
        <button onClick={() => inputRef.current?.click()} className="text-xs text-info hover:text-info/80 transition-colors">
          {currentImage ? "Alterar foto" : "Adicionar foto"}
        </button>
      )}
    </div>
  );
}

// ─── Org Card (Stars + SpacePoints + Plan) ─────────────────────────────────────
function OrgResourceCard({ org, plans, userId }: { org: OrgMembership; plans: Plan[]; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Stars
  const [starsAmt, setStarsAmt] = useState("");
  const [starsDesc, setStarsDesc] = useState("");
  const starsMut = useMutation({
    ...orpc.admin.adjustStars.mutationOptions(),
    onSuccess: (d) => { toast.success(`Saldo: ${d.newBalance.toLocaleString("pt-BR")} ★`); setStarsAmt(""); setStarsDesc(""); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao ajustar stars"),
  });

  // Space Points
  const [ptsAmt, setPtsAmt] = useState("");
  const [ptsDesc, setPtsDesc] = useState("");
  const ptsMut = useMutation({
    ...orpc.spacePoint.adminAdjust.mutationOptions(),
    onSuccess: (d) => { toast.success(`Pontos: ${d.newTotal.toLocaleString("pt-BR")} pts`); setPtsAmt(""); setPtsDesc(""); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao ajustar pontos"),
  });

  // Plan
  const [selectedPlan, setSelectedPlan] = useState(org.planId ?? "");
  const planMut = useMutation({
    ...orpc.admin.updateOrgPlan.mutationOptions(),
    onSuccess: () => { toast.success("Plano atualizado!"); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao atualizar plano"),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {org.orgLogo
            ? <img src={org.orgLogo} className="w-8 h-8 rounded-lg object-cover" />
            : <div className="w-8 h-8 rounded-lg bg-knob flex items-center justify-center text-xs font-bold text-foreground">{org.orgName[0]}</div>
          }
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{org.orgName}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[org.role] ?? org.role}
              {org.cargo && ` · ${org.cargo}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-warning text-xs font-semibold">
            <Star className="w-3.5 h-3.5" />
            {org.starsBalance.toLocaleString("pt-BR")}
          </div>
          <div className="flex items-center gap-1.5 text-info text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            {org.spacePoints.toLocaleString("pt-BR")} {org.spaceLevelEmoji}
          </div>
          <div className={cn("text-xs px-2 py-0.5 rounded-full font-medium", org.planId ? "bg-success/15 text-success" : "bg-knob text-muted-foreground")}>
            {org.planName ?? "Sem plano"}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded panels */}
      {open && (
        <div className="border-t border-border grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

          {/* Stars */}
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-warning flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Ajustar Stars</p>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="+500 ou -200"
                value={starsAmt}
                onChange={(e) => setStarsAmt(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
              />
              <input
                placeholder="Motivo (obrigatório)"
                value={starsDesc}
                onChange={(e) => setStarsDesc(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
              />
              <button
                onClick={() => { if (!starsAmt || !starsDesc) return; starsMut.mutate({ orgId: org.orgId, amount: parseInt(starsAmt), description: starsDesc }); }}
                disabled={!starsAmt || !starsDesc || starsMut.isPending}
                className="w-full py-2 bg-warning/20 hover:bg-warning/30 border border-warning/30 text-warning text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                {starsMut.isPending ? "Ajustando..." : "Aplicar"}
              </button>
            </div>
          </div>

          {/* Space Points */}
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-info flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Space Points</p>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="+100 ou -50"
                value={ptsAmt}
                onChange={(e) => setPtsAmt(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
              />
              <input
                placeholder="Motivo (opcional)"
                value={ptsDesc}
                onChange={(e) => setPtsDesc(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
              />
              <button
                onClick={() => { if (!ptsAmt) return; ptsMut.mutate({ userId, orgId: org.orgId, points: parseInt(ptsAmt), description: ptsDesc || "Ajuste manual pelo admin" }); }}
                disabled={!ptsAmt || ptsMut.isPending}
                className="w-full py-2 bg-info/20 hover:bg-info/30 border border-info/30 text-info text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                {ptsMut.isPending ? "Ajustando..." : "Aplicar"}
              </button>
            </div>
          </div>

          {/* Plan */}
          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold text-success flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Plano</p>
            <div className="space-y-2">
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground focus:outline-none focus:border-ring"
              >
                <option value="">Sem plano</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.monthlyStars.toLocaleString("pt-BR")} ★/mês</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Atual: <span className="text-foreground">{org.planName ?? "Sem plano"}</span>
              </p>
              <button
                onClick={() => planMut.mutate({ orgId: org.orgId, planId: selectedPlan || null })}
                disabled={planMut.isPending || selectedPlan === (org.planId ?? "")}
                className="w-full py-2 bg-success/20 hover:bg-success/30 border border-success/30 text-success text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                {planMut.isPending ? "Salvando..." : "Salvar plano"}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function AdminUserPanel({ userId, name, email, image, nickname, isSystemAdmin, isActive, createdAt, isSelf, orgs, plans }: AdminUserPanelProps) {
  const qc = useQueryClient();

  const [form, setForm] = useState({ name, nickname: nickname ?? "" });
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof orpc.admin.updateUser.call>[0]) => orpc.admin.updateUser.call(data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); qc.invalidateQueries(); },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: () => orpc.admin.deleteUser.call({ userId }),
    onSuccess: () => { window.location.href = "/admin/users"; },
    onError: () => toast.error("Erro ao excluir usuário"),
  });

  // Abre o NERP logado COMO este usuário (sem credenciais — auth sincronizada).
  // Nova aba = navegação top-level, pra o cookie de sessão colar no NERP.
  const nerpLoginMut = useMutation({
    mutationFn: () => orpc.admin.nerpLoginAs.call({ userId }),
    onSuccess: (res) => { window.open(res.url, "_blank", "noopener,noreferrer"); },
    onError: () => toast.error("Erro ao gerar acesso ao NERP"),
  });

  const toggleActive = () => updateMut.mutate({ userId, isActive: !isActive });
  const toggleAdmin  = () => updateMut.mutate({ userId, isSystemAdmin: !isSystemAdmin });

  return (
    <div className="space-y-6">
      {/* Top card: avatar + identity + toggles */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

          {/* Avatar */}
          <AvatarEditor userId={userId} currentImage={image} name={name} />

          {/* Identity */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground focus:outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Apelido</label>
                <input
                  value={form.nickname}
                  onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-muted border border-line rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
              <input value={email} disabled className="w-full px-3 py-2 bg-muted/40 border border-line/50 rounded-lg text-sm text-muted-foreground cursor-not-allowed" />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => updateMut.mutate({ userId, name: form.name, nickname: form.nickname || null })}
                disabled={updateMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {updateMut.isPending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
              </button>
              <p className="text-[11px] text-muted-foreground">
                Cadastrado em {new Date(createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex sm:flex-col gap-3 shrink-0">
            {/* Active/Inactive */}
            <button
              onClick={toggleActive}
              disabled={updateMut.isPending}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                isActive
                  ? "bg-success/15 border-success/30 text-success hover:bg-destructive/15 hover:border-destructive/30 hover:text-destructive"
                  : "bg-destructive/15 border-destructive/30 text-destructive hover:bg-success/15 hover:border-success/30 hover:text-success"
              )}
            >
              <Power className="w-3.5 h-3.5" />
              {isActive ? "Ativo" : "Inativo"}
            </button>

            {/* System Admin */}
            <button
              onClick={toggleAdmin}
              disabled={updateMut.isPending || isSelf}
              title={isSelf ? "Você não pode alterar o próprio admin" : undefined}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40",
                isSystemAdmin
                  ? "bg-info/15 border-info/30 text-info hover:bg-knob hover:border-line hover:text-muted-foreground"
                  : "bg-muted border-line text-muted-foreground hover:bg-info/15 hover:border-info/30 hover:text-info"
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isSystemAdmin ? "Admin" : "Comum"}
            </button>

            {/* Login no NERP como este usuário */}
            <button
              onClick={() => nerpLoginMut.mutate()}
              disabled={nerpLoginMut.isPending}
              title="Abrir o NERP logado como este usuário"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 bg-info/15 border-info/30 text-info hover:bg-info/25"
            >
              {nerpLoginMut.isPending
                ? <OrbitaSpinner className="w-3.5 h-3.5 " />
                : <ExternalLink className="w-3.5 h-3.5" />}
              Entrar no NERP
            </button>
          </div>
        </div>
      </div>

      {/* Orgs with stars/points/plan */}
      {orgs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Empresas & Recursos ({orgs.length})
          </h2>
          {orgs.map((org) => (
            <OrgResourceCard key={org.memberId} org={org} plans={plans} userId={userId} />
          ))}
        </div>
      )}

      {/* Danger zone */}
      {!isSelf && (
        <div className="bg-card border border-destructive/20 rounded-xl p-5">
          <p className="text-xs font-semibold text-destructive mb-3">Zona de perigo</p>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm rounded-lg transition-colors">
              Excluir usuário permanentemente
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive">Confirmar exclusão de <strong>{name}</strong>?</p>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="px-4 py-2 bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50 text-sm rounded-lg transition-colors">
                {deleteMut.isPending ? "Excluindo..." : "Excluir"}
              </button>
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 bg-muted hover:bg-knob text-foreground text-sm rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
