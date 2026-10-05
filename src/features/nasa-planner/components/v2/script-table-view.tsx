"use client";

import { addDays, format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./client-avatar";
import { POST_STATUS_META, POST_TYPE_META, WEEKDAY_LABELS, isScriptOnlyPost, postDate } from "./planner-v2-utils";
import type { CalendarPost, PlannerClient } from "./planner-v2-types";

/** Visão "Roteiro" (spec 0067, RF-4): a semana em tabela — dia, formato, objetivo, conteúdo e CTA. */
export function ScriptTableView({
  weekStart,
  posts,
  clients,
  weekdayThemes,
  themeClient,
  onOpenPost,
  onCreateForDay,
}: {
  weekStart: Date;
  posts: CalendarPost[];
  clients: PlannerClient[];
  weekdayThemes: Array<{ organizationId: string; weekday: number; theme: string }>;
  themeClient: PlannerClient | null;
  onOpenPost: (postId: string) => void;
  onCreateForDay: (day: Date) => void;
}) {
  // Semana do roteiro começa na segunda e termina no domingo, como o planejamento de conteúdo.
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index + 1));
  const showClient = clients.length > 1 && !themeClient;

  return (
    <>
      <div className="space-y-4 px-3 pb-3 md:hidden">
        {days.map((day) => {
          const dayPosts = posts
            .filter((post) => {
              const date = postDate(post);
              return date && isSameDay(date, day);
            })
            .sort((first, second) => (postDate(first)?.getTime() ?? 0) - (postDate(second)?.getTime() ?? 0));
          const dayTheme = themeClient
            ? weekdayThemes.find((candidate) => candidate.organizationId === themeClient.id && candidate.weekday === day.getDay())?.theme
            : undefined;
          return (
            <section key={day.toISOString()}>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-bold">
                  {WEEKDAY_LABELS[day.getDay()]} <span className="text-xs font-normal text-muted-foreground">{format(day, "dd/MM")}</span>
                </p>
                {dayTheme && (
                  <span className="ml-auto max-w-[55%] truncate rounded-full bg-info/15 px-2 py-0.5 text-[10.5px] font-semibold text-info">{dayTheme}</span>
                )}
              </div>
              {dayPosts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onCreateForDay(day)}
                  className="w-full rounded-[18px] border-[1.5px] border-dashed border-line py-3 text-xs text-muted-foreground"
                >
                  + Conteúdo neste dia
                </button>
              ) : (
                <div className="space-y-1.5">
                  {dayPosts.map((post) => {
                    const isPending = isScriptOnlyPost(post);
                    return (
                      <div key={post.id} className="rounded-[18px] bg-panel p-3">
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px]">{POST_TYPE_META[post.type].label}</span>
                          <span className={cn("ml-auto shrink-0 text-[11px]", POST_STATUS_META[post.status].textClassName)}>
                            {POST_STATUS_META[post.status].label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold">{post.title || POST_TYPE_META[post.type].label}</p>
                        {(post.objective || dayTheme) && <p className="mt-0.5 text-xs text-info">{post.objective || dayTheme}</p>}
                        {post.cta && <p className="mt-1 text-xs text-muted-foreground">CTA: {post.cta}</p>}
                        <button
                          type="button"
                          onClick={() => onOpenPost(post.id)}
                          className={cn("mt-2.5 h-9 w-full rounded-full text-sm font-semibold", isPending ? "bg-foreground text-background" : "bg-card")}
                        >
                          {isPending ? "Criar" : "Abrir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="overflow-x-auto px-3 pb-3 max-md:hidden">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              {["Dia", "Formato", "Objetivo / Gatilho", "Conteúdo principal", "CTA", "Status", ""].map((heading) => (
                <th key={heading} className="border-b border-line px-2 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dayPosts = posts
                .filter((post) => {
                  const date = postDate(post);
                  return date && isSameDay(date, day);
                })
                .sort((first, second) => (postDate(first)?.getTime() ?? 0) - (postDate(second)?.getTime() ?? 0));
              const dayTheme = themeClient
                ? weekdayThemes.find((candidate) => candidate.organizationId === themeClient.id && candidate.weekday === day.getDay())?.theme
                : undefined;
              const dayLabel = (
                <td className="border-b border-line px-2 py-2.5 align-top whitespace-nowrap">
                  <span className="font-semibold">{WEEKDAY_LABELS[day.getDay()]}</span>{" "}
                  <span className="text-xs text-muted-foreground">{format(day, "dd/MM")}</span>
                </td>
              );
              if (dayPosts.length === 0) {
                return (
                  <tr key={day.toISOString()}>
                    {dayLabel}
                    <td className="border-b border-line px-2 py-2.5 text-muted-foreground">—</td>
                    <td className="border-b border-line px-2 py-2.5 text-info">{dayTheme ?? <span className="text-muted-foreground">—</span>}</td>
                    <td colSpan={3} className="border-b border-line px-2 py-2.5 text-xs text-muted-foreground">
                      Nenhum conteúdo neste dia.
                    </td>
                    <td className="border-b border-line px-2 py-2.5 text-right">
                      <button type="button" onClick={() => onCreateForDay(day)} className="rounded-full bg-panel px-3 py-1 text-xs font-medium">
                        + Conteúdo
                      </button>
                    </td>
                  </tr>
                );
              }
              return dayPosts.map((post, postIndex) => {
                const clientIndex = clients.findIndex((client) => client.id === post.organizationId);
                const isPending = isScriptOnlyPost(post);
                return (
                  <tr key={post.id} className="hover:bg-panel/50">
                    {postIndex === 0 ? dayLabel : <td className="border-b border-line" />}
                    <td className="border-b border-line px-2 py-2.5 align-top">
                      <span className="rounded-full bg-panel px-2 py-0.5 text-xs">{POST_TYPE_META[post.type].label}</span>
                    </td>
                    <td className="border-b border-line px-2 py-2.5 align-top">
                      {post.objective || dayTheme || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="border-b border-line px-2 py-2.5 align-top">
                      <button type="button" onClick={() => onOpenPost(post.id)} className="flex items-start gap-1.5 text-left font-medium hover:underline">
                        {showClient && clients[clientIndex] && (
                          <ClientAvatar
                            name={clients[clientIndex].name}
                            logo={clients[clientIndex].logo}
                            clientIndex={clientIndex}
                            className="mt-0.5 size-4 text-[7px] ring-1"
                          />
                        )}
                        {post.title || POST_TYPE_META[post.type].label}
                      </button>
                    </td>
                    <td className="border-b border-line px-2 py-2.5 align-top text-muted-foreground">{post.cta || "—"}</td>
                    <td className={cn("border-b border-line px-2 py-2.5 align-top text-xs whitespace-nowrap", POST_STATUS_META[post.status].textClassName)}>
                      {POST_STATUS_META[post.status].label}
                    </td>
                    <td className="border-b border-line px-2 py-2.5 text-right align-top">
                      <button
                        type="button"
                        onClick={() => onOpenPost(post.id)}
                        className={cn("rounded-full px-3 py-1 text-xs font-semibold", isPending ? "bg-foreground text-background" : "bg-panel")}
                      >
                        {isPending ? "Criar" : "Abrir"}
                      </button>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
