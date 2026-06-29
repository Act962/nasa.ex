"use client";

import { useState } from "react";
import { client } from "@/lib/orpc";
import type { LinnkerPage, LinnkerLink } from "../types";
import { getTrackingParamsClient } from "@/lib/tracking/tracking-params";

interface Props {
  page: Pick<LinnkerPage, "title" | "coverColor" | "buttonStyle" | "avatarUrl">;
  link: Pick<LinnkerLink, "id" | "title" | "emoji" | "url"> & { pageId: string };
}

export function LinnkerCapturePage({ page, link }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const pageSlug = typeof window !== "undefined"
    ? window.location.pathname.split("/l/")[1]?.split("/")[0] ?? ""
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Digite seu nome"); return; }
    setLoading(true);
    setError("");
    try {
      await client.linnker.captureLead({
        linkId: link.id,
        pageSlug,
        name,
        email: email || undefined,
        phone: phone || undefined,
        tracking: getTrackingParamsClient(),
      });
      setDone(true);
      // Redirect after 1.5s
      setTimeout(() => {
        window.location.href = link.url;
      }, 1500);
    } catch (err: any) {
      setError(err?.message ?? "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center" style={{ background: "#f3f4f6" }}>
      {/* Cover */}
      <div className="w-full h-36 flex items-end justify-center" style={{ background: page.coverColor }}>
        <div className="size-20 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center -mb-10 overflow-hidden">
          {page.avatarUrl
            ? <img src={page.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl">{link.emoji ?? "🔗"}</span>}
        </div>
      </div>

      <div className="w-full max-w-sm px-4 pt-14 pb-10 flex flex-col items-center gap-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-900">{page.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Preencha seus dados para acessar <strong>{link.title}</strong>
          </p>
        </div>

        {done ? (
          <div className="w-full flex flex-col items-center gap-3 py-8">
            <div className="size-14 rounded-full flex items-center justify-center text-3xl" style={{ background: page.coverColor + "22" }}>
              ✅
            </div>
            <p className="font-semibold text-zinc-800">Dados recebidos!</p>
            <p className="text-zinc-500 text-sm">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 mb-1 block">Nome *</label>
              <input
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-offset-1"
                style={{ "--tw-ring-color": page.coverColor } as React.CSSProperties}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 mb-1 block">WhatsApp</label>
              <input
                type="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-offset-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 mb-1 block">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-offset-1"
              />
            </div>

            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm shadow-md hover:opacity-90 active:scale-95 transition-all mt-2 disabled:opacity-60"
              style={{ background: page.coverColor }}
            >
              {loading ? "Enviando..." : `Acessar ${link.emoji ?? ""} ${link.title}`}
            </button>
          </form>
        )}

        <p className="text-xs text-zinc-400">
          Feito com <span className="font-semibold" style={{ color: page.coverColor }}>Linnker</span> · NASA
        </p>
      </div>
    </div>
  );
}
