import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";

const ROLES = [
  {
    role: "owner",
    label: "Owner (Dono)",
    description: "Acesso total à empresa. Pode gerenciar membros, planos e configurações.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    role: "admin",
    label: "Admin",
    description: "Pode gerenciar membros e configurações da empresa.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    role: "moderador",
    label: "Moderador",
    description: "Pode visualizar e moderar conteúdo. Permissões personalizáveis.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    role: "member",
    label: "Membro",
    description: "Acesso básico à plataforma conforme permissões configuradas.",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
  },
];

export default async function RolesPage() {
  await requireAdminSession();

  const roleCounts = await prisma.member.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  const countMap: Record<string, number> = {};
  for (const r of roleCounts) countMap[r.role] = r._count.role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Tipos de Usuário</h1>
        <p className="text-sm text-zinc-400 mt-1">Funções disponíveis na plataforma</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ROLES.map(({ role, label, description, color, bg }) => (
          <div key={role} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${color} mb-2`}>
                  {role}
                </span>
                <h3 className="text-sm font-semibold text-white">{label}</h3>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{(countMap[role] ?? 0).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-zinc-500">usuários</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">{description}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">Sobre os tipos de usuário</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Os tipos de usuário são definidos por empresa (por membro). Um mesmo usuário pode ter
          funções diferentes em empresas distintas. As permissões específicas de cada função por
          aplicativo podem ser configuradas na página de <strong className="text-zinc-300">Permissões</strong> ou
          diretamente em cada empresa.
        </p>
      </div>
    </div>
  );
}
