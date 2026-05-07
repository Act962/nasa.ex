import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  GraduationCap,
  FolderTree,
  ListChecks,
  Image as ImageIcon,
  Route,
  PlayCircle,
  Award,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

export default async function AdminSpaceHelpDashboardPage() {
  await requireAdminSession();

  const [
    categoriesCount,
    categoriesPublishedCount,
    featuresCount,
    stepsCount,
    tracksCount,
    tracksPublishedCount,
    lessonsCount,
    badgesCount,
    badgesActiveCount,
    awardsCount,
    featuresWithoutVideo,
    stepsWithoutScreenshot,
  ] = await Promise.all([
    prisma.spaceHelpCategory.count(),
    prisma.spaceHelpCategory.count({ where: { isPublished: true } }),
    prisma.spaceHelpFeature.count(),
    prisma.spaceHelpStep.count(),
    prisma.spaceHelpTrack.count(),
    prisma.spaceHelpTrack.count({ where: { isPublished: true } }),
    prisma.spaceHelpLesson.count(),
    prisma.spaceHelpBadge.count(),
    prisma.spaceHelpBadge.count({ where: { isActive: true } }),
    prisma.userSpaceHelpBadge.count(),
    prisma.spaceHelpFeature.count({
      where: { OR: [{ youtubeUrl: null }, { youtubeUrl: "" }] },
    }),
    prisma.spaceHelpStep.count({
      where: { OR: [{ screenshotUrl: null }, { screenshotUrl: "" }] },
    }),
  ]);

  const cards = [
    {
      title: "Tópicos",
      subtitle: `${categoriesPublishedCount} publicado(s) de ${categoriesCount}`,
      icon: FolderTree,
      color: "text-blue-400",
      href: "/admin/space-help/categorias",
      cta: "Gerenciar tópicos",
    },
    {
      title: "Funcionalidades",
      subtitle: `${featuresCount} subtópico(s) cadastrado(s)`,
      icon: ListChecks,
      color: "text-emerald-400",
      href: "/admin/space-help/categorias",
      cta: "Editar via tópicos",
    },
    {
      title: "Trilhas",
      subtitle: `${tracksPublishedCount} publicada(s) de ${tracksCount}`,
      icon: Route,
      color: "text-violet-400",
      href: "/admin/space-help/trilhas",
      cta: "Gerenciar trilhas",
    },
    {
      title: "Selos",
      subtitle: `${badgesActiveCount} ativo(s) · ${awardsCount} concedido(s)`,
      icon: Award,
      color: "text-amber-400",
      href: "/admin/space-help/selos",
      cta: "Gerenciar selos",
    },
  ];

  const totals = [
    { label: "Tópicos", value: categoriesCount, icon: FolderTree, color: "text-blue-400" },
    { label: "Funcionalidades", value: featuresCount, icon: ListChecks, color: "text-emerald-400" },
    { label: "Passos", value: stepsCount, icon: ImageIcon, color: "text-pink-400" },
    { label: "Trilhas", value: tracksCount, icon: Route, color: "text-violet-400" },
    { label: "Aulas", value: lessonsCount, icon: PlayCircle, color: "text-cyan-400" },
    { label: "Selos", value: badgesCount, icon: Award, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-violet-400" /> Space Help
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Hub educacional NASA — gerencie tópicos, funcionalidades, trilhas e
            selos exibidos para todas as empresas.
          </p>
        </div>
        <Link
          href="/space-help"
          target="_blank"
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-violet-300 border border-zinc-800 hover:border-violet-500/40 px-3 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Ver na plataforma
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {totals.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                {label}
              </span>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <p className="text-xl font-bold text-white">
              {value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(({ title, subtitle, icon: Icon, color, href, cta }) => (
          <Link
            key={title}
            href={href}
            className="bg-zinc-900 border border-zinc-800 hover:border-violet-500/40 rounded-xl p-5 transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <Icon className={`w-6 h-6 ${color}`} />
              <span className="text-xs text-violet-400 group-hover:text-violet-300 transition-colors">
                {cta} →
              </span>
            </div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
          </Link>
        ))}
      </div>

      {(featuresWithoutVideo > 0 || stepsWithoutScreenshot > 0) && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" /> Conteúdo incompleto
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {featuresWithoutVideo > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-300">
                  <strong className="text-amber-300">{featuresWithoutVideo}</strong>{" "}
                  funcionalidade(s) sem vídeo cadastrado.
                </p>
              </div>
            )}
            {stepsWithoutScreenshot > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                <p className="text-zinc-300">
                  <strong className="text-amber-300">{stepsWithoutScreenshot}</strong>{" "}
                  passo(s) sem screenshot.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
