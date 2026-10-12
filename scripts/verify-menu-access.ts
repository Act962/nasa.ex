// Confere a regra de acesso aos menus de botões (auditoria A8): só membro da empresa dona do funil.
// Rodar: pnpm tsx --conditions=react-server scripts/verify-menu-access.ts <organizationId> <trackingId> <userIdMembro>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { canAccessMenu, canAccessTrackingMenus } from "../src/app/router/ia/button-preset-access";

const [organizationId, trackingId, memberUserId] = process.argv.slice(2);
let failures = 0;
function check(label: string, isOk: boolean) {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}`);
}

async function main() {
  const outsider = await prisma.user.findFirst({ where: { members: { none: { organizationId } } }, select: { id: true } });
  const menu = await prisma.aiButtonPreset.findFirst({ where: { trackingId }, select: { id: true } });
  check("membro acessa os menus do funil", await canAccessTrackingMenus(trackingId, memberUserId));
  check("funil inexistente é recusado", !(await canAccessTrackingMenus("nao-existe", memberUserId)));
  if (menu) check("membro acessa um menu pelo id", await canAccessMenu(menu.id, memberUserId));
  check("menu inexistente é recusado", !(await canAccessMenu("nao-existe", memberUserId)));
  if (outsider) {
    check("usuário de outra empresa não acessa os menus do funil", !(await canAccessTrackingMenus(trackingId, outsider.id)));
    if (menu) check("usuário de outra empresa não acessa o menu pelo id", !(await canAccessMenu(menu.id, outsider.id)));
  } else {
    console.log("aviso: nenhum usuário de fora da empresa no banco; caso não conferido");
  }
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
