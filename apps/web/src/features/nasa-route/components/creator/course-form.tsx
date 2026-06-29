"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { HeaderFields } from "./forms/header-fields";
import {
  hasLessons,
  isCourseFormat,
  type CourseFormat,
  type CommunityType,
  type SubscriptionPeriod,
} from "@/features/nasa-route/lib/formats";
import { FormatSelect } from "./forms/format-select";
import { LessonsInfoCard } from "./forms/lessons-info-card";
import {
  EbookUploadSection,
  type EbookData,
} from "./forms/ebook-upload-section";
import { EventSection, type EventData } from "./forms/event-section";
import {
  CommunitySection,
  type CommunityData,
} from "./forms/community-section";
import {
  SubscriptionSection,
  type SubscriptionData,
} from "./forms/subscription-section";
import {
  centsToBrlInput,
  parseBrlInputToCents,
} from "@/features/nasa-route/lib/price-input";

interface InitialCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  trailerUrl: string | null;
  level: string;
  format: string;
  durationMin: number | null;
  priceStars: number;
  priceBrlCents?: number;
  isFree?: boolean;
  categoryId: string | null;
  rewardSpOnComplete: number;

  // Datas UNIFICADAS (todos os formatos podem ter)
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;

  // Novos campos por formato (todos opcionais — só vêm preenchidos se já existirem)
  ebookFileKey?: string | null;
  ebookFileName?: string | null;
  ebookFileSize?: number | null;
  ebookMimeType?: string | null;
  ebookPageCount?: number | null;
  eventStartsAt?: Date | string | null;
  eventEndsAt?: Date | string | null;
  eventStreamUrl?: string | null;
  eventTimezone?: string | null;
  eventLocationNote?: string | null;
  communityType?: string | null;
  communityInviteUrl?: string | null;
  communityRules?: string | null;
  subscriptionPeriod?: string | null;

  // Funil pós-compra
  purchaseTrackingId?: string | null;
  purchaseStatusId?: string | null;
}

interface Props {
  courseId?: string;
  initial?: InitialCourse;
  onSaved?: (courseId: string) => void;
}

function toDateOrNull(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata Date pra value de `<input type="datetime-local">` (YYYY-MM-DDTHH:mm).
 * Necessário porque `Date.toISOString()` tem timezone Z, que o input rejeita.
 */
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CourseForm({ courseId, initial, onSaved }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!courseId;

  // ── Estado dos campos comuns ──────────────────────────────
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [trailerUrl, setTrailerUrl] = useState(initial?.trailerUrl ?? "");
  const [level, setLevel] = useState(initial?.level ?? "beginner");
  const [format, setFormat] = useState<CourseFormat>(
    isCourseFormat(initial?.format ?? "") ? (initial!.format as CourseFormat) : "course",
  );
  const [durationMin, setDurationMin] = useState(
    initial?.durationMin?.toString() ?? "",
  );
  const [priceStars, setPriceStars] = useState(
    initial?.priceStars?.toString() ?? "0",
  );
  const [isFree, setIsFree] = useState<boolean>(initial?.isFree ?? false);
  // Mantemos o valor em reais (não centavos) na UI para o criador.
  const [priceBrl, setPriceBrl] = useState<string>(
    centsToBrlInput(initial?.priceBrlCents),
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [rewardSpOnComplete, setRewardSpOnComplete] = useState(
    initial?.rewardSpOnComplete?.toString() ?? "0",
  );

  // ── Datas unificadas — todos os formatos podem ter ──────
  // `startsAt`/`endsAt` valem pra qualquer formato (course, training,
  // mentoring, ebook, event, community, subscription). Diferente dos
  // campos antigos `eventStartsAt`/`eventEndsAt` (que valiam só pra
  // format="event" e ficam preservados pra compat).
  const [startsAt, setStartsAt] = useState<Date | null>(
    toDateOrNull(initial?.startsAt),
  );
  const [endsAt, setEndsAt] = useState<Date | null>(
    toDateOrNull(initial?.endsAt),
  );

  // ── Funil pós-compra (tracking + status) ──────────────────
  const [purchaseTrackingId, setPurchaseTrackingId] = useState<string>(
    initial?.purchaseTrackingId ?? "",
  );
  const [purchaseStatusId, setPurchaseStatusId] = useState<string>(
    initial?.purchaseStatusId ?? "",
  );

  // ── Estado por formato ────────────────────────────────────
  const [ebook, setEbook] = useState<EbookData>({
    ebookFileKey: initial?.ebookFileKey ?? null,
    ebookFileName: initial?.ebookFileName ?? null,
    ebookFileSize: initial?.ebookFileSize ?? null,
    ebookMimeType: initial?.ebookMimeType ?? null,
    ebookPageCount: initial?.ebookPageCount ?? null,
  });
  const [event, setEvent] = useState<EventData>({
    eventStartsAt: toDateOrNull(initial?.eventStartsAt),
    eventEndsAt: toDateOrNull(initial?.eventEndsAt),
    eventStreamUrl: initial?.eventStreamUrl ?? null,
    eventTimezone: initial?.eventTimezone ?? "America/Sao_Paulo",
    eventLocationNote: initial?.eventLocationNote ?? null,
  });
  const [community, setCommunity] = useState<CommunityData>({
    communityType: (initial?.communityType ?? null) as CommunityType | null,
    communityInviteUrl: initial?.communityInviteUrl ?? null,
    communityRules: initial?.communityRules ?? null,
  });
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscriptionPeriod: (initial?.subscriptionPeriod ?? "monthly") as SubscriptionPeriod,
  });

  const { data: searchData } = useQuery({
    ...orpc.nasaRoute.publicSearch.queryOptions({ input: { limit: 1 } }),
  });
  const categories = searchData?.categories ?? [];

  // ── Trackings + Status pra o select do funil pós-compra ──
  // `tracking.list` retorna array direto (não `{ trackings: [...] }`).
  // Filtra trackings em que o usuário PARTICIPA da org criadora —
  // backend já garante via `participants: { some: { userId } }`.
  const { data: trackingsList } = useQuery({
    ...orpc.tracking.list.queryOptions(),
  });
  const trackings = (trackingsList as any[]) ?? [];
  // Carrega status do tracking selecionado (lazy — só busca quando há
  // tracking escolhido). `enabled` evita query inútil.
  const { data: statusesData } = useQuery({
    ...orpc.status.listSimple.queryOptions({
      input: { trackingId: purchaseTrackingId },
    }),
    enabled: !!purchaseTrackingId,
  });
  // `status.listSimple` retorna `{ status: [...] }`.
  const statuses = (statusesData as any)?.status ?? [];

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertCourse.mutationOptions(),
    onSuccess: (res) => {
      const newId = res?.course?.id;
      toast.success(isEdit ? "Curso atualizado!" : "Curso criado!");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
      if (onSaved && newId) {
        onSaved(newId);
        return;
      }
      if (!isEdit) {
        if (!newId) {
          toast.error(
            "Curso criado, mas não foi possível abrir o editor automaticamente.",
          );
          router.push("/nasa-route/criador");
          return;
        }
        const target = `/nasa-route/criador/curso/${newId}/editar`;
        router.replace(target);
        // Fallback caso o router não navegue (Next 16 + state batching)
        setTimeout(() => {
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.includes(newId)
          ) {
            window.location.href = target;
          }
        }, 250);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível salvar.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !title.trim()) {
      toast.error("Slug e título são obrigatórios.");
      return;
    }

    upsert.mutate({
      id: courseId,
      slug: slug.trim(),
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      description: description.trim() || null,
      coverUrl: coverUrl.trim() || null,
      trailerUrl: trailerUrl.trim() || null,
      level: level as "beginner" | "intermediate" | "advanced",
      format,
      durationMin: durationMin ? Number(durationMin) : null,
      priceStars: Number(priceStars) || 0,
      priceBrlCents: isFree ? 0 : parseBrlInputToCents(priceBrl),
      isFree,
      categoryId: categoryId || null,
      rewardSpOnComplete: Number(rewardSpOnComplete) || 0,
      // Datas unificadas — todos os formatos podem ter
      startsAt,
      endsAt,
      // Funil pós-compra (CRM)
      purchaseTrackingId: purchaseTrackingId || null,
      purchaseStatusId: purchaseStatusId || null,
      // Campos por formato — o procedure persiste só os relevantes pro
      // `format` atual e zera o resto.
      ebookFileKey: ebook.ebookFileKey,
      ebookFileName: ebook.ebookFileName,
      ebookFileSize: ebook.ebookFileSize,
      ebookMimeType: ebook.ebookMimeType,
      ebookPageCount: ebook.ebookPageCount,
      eventStartsAt: event.eventStartsAt,
      eventEndsAt: event.eventEndsAt,
      eventStreamUrl: event.eventStreamUrl,
      eventTimezone: event.eventTimezone,
      eventLocationNote: event.eventLocationNote,
      communityType: community.communityType,
      communityInviteUrl: community.communityInviteUrl,
      communityRules: community.communityRules,
      subscriptionPeriod: subscription.subscriptionPeriod,
    });
  }

  function autoSlug() {
    if (slug || !title) return;
    setSlug(
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 60),
    );
  }

  const isLessons = hasLessons(format);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <HeaderFields
        value={{ coverUrl, title, slug, subtitle, description }}
        onAutoSlug={autoSlug}
        onChange={(v) => {
          setCoverUrl(v.coverUrl);
          setTitle(v.title);
          setSlug(v.slug);
          setSubtitle(v.subtitle);
          setDescription(v.description);
        }}
      />

      {/* ── Formato e seção dependente ─────────────────────── */}
      <FormatSelect value={format} onChange={setFormat} />

      {isLessons && <LessonsInfoCard isEdit={isEdit} />}
      {format === "ebook" && (
        <EbookUploadSection value={ebook} onChange={setEbook} />
      )}
      {format === "event" && (
        <EventSection value={event} onChange={setEvent} />
      )}
      {format === "community" && (
        <CommunitySection value={community} onChange={setCommunity} />
      )}
      {format === "subscription" && (
        <SubscriptionSection value={subscription} onChange={setSubscription} />
      )}

      {/* ── Datas unificadas: válido pra TODOS os formatos ───
          Quando preenchidas, o cron `nasa-route-archive-past-events`
          arquiva o curso/evento automaticamente após `endsAt`. */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold">Datas (opcional)</p>
          <p className="text-xs text-muted-foreground">
            Janela em que o conteúdo está ativo. Eventos com data de fim
            no passado são arquivados automaticamente.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startsAt">Início</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt ? toDatetimeLocalValue(startsAt) : ""}
              onChange={(e) =>
                setStartsAt(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsAt">Fim</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={endsAt ? toDatetimeLocalValue(endsAt) : ""}
              onChange={(e) =>
                setEndsAt(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>
        </div>
      </div>

      {/* ── Funil de vendas pós-compra (CRM) ─────────────────
          Quando alguém compra este curso, o sistema cria/move um lead
          no tracking + status configurados. Permite o criador puxar
          os compradores pro CRM e fazer follow-up no atendimento. */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold">Funil de vendas (opcional)</p>
          <p className="text-xs text-muted-foreground">
            Direcione cada lead que comprar este curso pra um tracking +
            status do seu CRM. Sem isso, a compra cria só o registro
            financeiro (Payments).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchaseTracking">Tracking</Label>
            <Select
              value={purchaseTrackingId || "none"}
              onValueChange={(v) => {
                setPurchaseTrackingId(v === "none" ? "" : v);
                setPurchaseStatusId(""); // reseta o status ao trocar de tracking
              }}
            >
              <SelectTrigger id="purchaseTracking">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não usar funil</SelectItem>
                {trackings.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchaseStatus">Status inicial</Label>
            <Select
              value={purchaseStatusId || "none"}
              onValueChange={(v) =>
                setPurchaseStatusId(v === "none" ? "" : v)
              }
              disabled={!purchaseTrackingId}
            >
              <SelectTrigger id="purchaseStatus">
                <SelectValue
                  placeholder={
                    purchaseTrackingId
                      ? "Selecione…"
                      : "Escolha o tracking primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Status padrão (primeira coluna)</SelectItem>
                {statuses.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Nível, categoria, preço, recompensas ────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="level">Nível</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Iniciante</SelectItem>
              <SelectItem value="intermediate">Intermediário</SelectItem>
              <SelectItem value="advanced">Avançado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Select
            value={categoryId || "none"}
            onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
          />
          <span>Curso gratuito (sem cobrança)</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Cursos gratuitos pulam o checkout — o aluno entra direto após
          fazer cadastro/login.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priceBrl">
            Preço (R$)
            {format === "subscription" && " — por mês"}
          </Label>
          <Input
            id="priceBrl"
            type="text"
            inputMode="decimal"
            value={priceBrl}
            onChange={(e) => setPriceBrl(e.target.value)}
            disabled={isFree}
            placeholder={isFree ? "Gratuito" : "Ex: 49,90"}
          />
          <p className="text-xs text-muted-foreground">
            Valor cobrado via Stripe. Mínimo R$ 0,50.
          </p>
        </div>
        {isLessons && (
          <div className="space-y-2">
            <Label htmlFor="durationMin">Duração total (min)</Label>
            <Input
              id="durationMin"
              type="number"
              min={0}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="reward">Bônus SP ao concluir</Label>
          <Input
            id="reward"
            type="number"
            min={0}
            value={rewardSpOnComplete}
            onChange={(e) => setRewardSpOnComplete(e.target.value)}
          />
        </div>
      </div>

      {isLessons && (
        <div className="space-y-2">
          <Label htmlFor="trailer">URL do trailer (YouTube ou Vimeo)</Label>
          <Input
            id="trailer"
            value={trailerUrl}
            onChange={(e) => setTrailerUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=… ou https://vimeo.com/…"
          />
          <p className="text-xs text-muted-foreground">
            Aparece no preview público. Opcional.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm dark:border-violet-800/40 dark:bg-violet-900/20">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-violet-600" />
          <p className="text-violet-900 dark:text-violet-200">
            Você recebe <strong>90% do valor pago</strong> — a plataforma retém
            10% como taxa. Ex.: produto de 500★ → você recebe 450★.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={upsert.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={upsert.isPending} className="gap-1.5">
          {upsert.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isEdit ? "Salvar alterações" : "Criar produto"}
        </Button>
      </div>
    </form>
  );
}
