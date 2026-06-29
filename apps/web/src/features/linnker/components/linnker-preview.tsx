"use client";

import type { LinnkerPage, SocialLink } from "../types";

const BUTTON_RADIUS: Record<string, string> = {
  pill: "9999px",
  rounded: "12px",
  sharp: "0px",
};

interface Props {
  page: LinnkerPage | undefined;
}

export function LinnkerPreview({ page }: Props) {
  if (!page) return null;
  const radius = BUTTON_RADIUS[page.buttonStyle] ?? "12px";
  const socialLinks = (page.socialLinks as SocialLink[]) ?? [];
  const activeLinks = page.links.filter((l) => l.isActive);

  return (
    <div className="w-full max-w-[280px] mx-auto bg-white dark:bg-zinc-900 rounded-[32px] border-2 border-border shadow-2xl overflow-hidden">
      {/* Phone notch mock */}
      <div className="h-6 bg-black flex items-center justify-center">
        <div className="w-16 h-1.5 rounded-full bg-zinc-700" />
      </div>

      {/* Screen */}
      <div
        className="h-[540px] overflow-y-auto relative"
        style={{ background: page.backgroundColor ?? "#f3f4f6" }}
      >
        {/* Background image */}
        {page.backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url(${page.backgroundImage})`,
              opacity: page.backgroundOpacity ?? 0.15,
            }}
          />
        )}

        {/* Top banner */}
        {page.bannerUrl ? (
          <div className="relative">
            <img
              src={page.bannerUrl}
              alt="Banner"
              className="w-full object-cover"
              style={{ maxHeight: "80px" }}
            />
            {/* Avatar over banner */}
            <div className="flex justify-center -mt-8 relative z-10">
              <div
                className="size-14 rounded-full border-4 bg-white shadow overflow-hidden"
                style={{ borderColor: page.coverColor }}
              >
                {page.avatarUrl ? (
                  <img src={page.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl"
                    style={{ background: page.coverColor }}>
                    🔗
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Cover color header */
          <div
            className="h-20 flex items-end justify-center relative"
            style={{ background: page.coverColor }}
          >
            <div className="size-14 rounded-full bg-white border-4 border-white shadow flex items-center justify-center -mb-7 overflow-hidden">
              {page.avatarUrl ? (
                <img src={page.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🔗</span>
              )}
            </div>
          </div>
        )}

        <div className={`px-4 pb-4 text-center relative ${page.bannerUrl ? "pt-3" : "pt-10"}`}>
          <h2 className="font-bold text-sm" style={{ color: page.titleColor ?? "#111827" }}>{page.title}</h2>
          {page.bio && (
            <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: page.bioColor ?? "#6b7280" }}>{page.bio}</p>
          )}
        </div>

        {/* Links */}
        <div className="px-4 space-y-2 pb-4 relative">
          {activeLinks.map((link) => {
            if (link.displayStyle === "banner") {
              return (
                <div
                  key={link.id}
                  className="w-full overflow-hidden shadow-sm"
                  style={{ borderRadius: radius }}
                >
                  {link.imageUrl ? (
                    <div className="relative">
                      <img
                        src={link.imageUrl}
                        alt={link.title}
                        className="w-full object-cover"
                        style={{ maxHeight: "64px" }}
                      />
                      {link.title && (
                        <div
                          className="absolute bottom-0 left-0 right-0 px-2 py-1 text-white font-semibold text-[10px]"
                          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
                        >
                          {link.title}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center gap-1 px-3 py-3 text-white text-xs font-medium"
                      style={{ background: page.coverColor }}
                    >
                      <span>{link.emoji ?? "🔗"}</span>
                      <span className="truncate">{link.title}</span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={link.id}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-white shadow-sm"
                style={{ background: link.color ?? page.coverColor, borderRadius: radius }}
              >
                {link.imageUrl ? (
                  <img src={link.imageUrl} alt="" className="size-5 rounded object-cover shrink-0" />
                ) : (
                  <span className="text-base">{link.emoji ?? "🔗"}</span>
                )}
                <span className="truncate text-xs">{link.title}</span>
              </div>
            );
          })}

          {activeLinks.length === 0 && (
            <p className="text-center text-xs text-zinc-400 py-4">
              Adicione links para aparecerem aqui
            </p>
          )}
        </div>

        {/* Social footer */}
        {socialLinks.filter((s) => s.url).length > 0 && (
          <div className="flex items-center justify-center gap-3 px-4 pb-4 relative">
            {socialLinks
              .filter((s) => s.url)
              .map((s, i) => (
                <div
                  key={i}
                  className="size-6 rounded-full flex items-center justify-center text-zinc-500"
                  title={s.platform}
                >
                  <span className="text-sm">
                    {s.platform === "instagram" ? "📸"
                      : s.platform === "facebook" ? "👥"
                      : s.platform === "tiktok" ? "🎵"
                      : s.platform === "twitter" ? "🐦"
                      : s.platform === "whatsapp" ? "💬"
                      : s.platform === "youtube" ? "▶️"
                      : s.platform === "linkedin" ? "💼"
                      : "🌐"}
                  </span>
                </div>
              ))}
          </div>
        )}

        <p className="text-center text-[10px] text-zinc-400 pb-4 relative">Linnker · NASA</p>
      </div>

      {/* Bottom bar */}
      <div className="h-5 bg-black flex items-center justify-center">
        <div className="w-20 h-1 rounded-full bg-zinc-600" />
      </div>
    </div>
  );
}
