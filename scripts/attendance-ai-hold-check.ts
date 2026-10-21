// Confere as regras puras de quando a IA fala (spec 0113, revisão 9.1), sem banco. Rodar:
//   pnpm tsx scripts/attendance-ai-hold-check.ts
// CA-R3 a CA-R5 dependem do banco e do Inngest e ficam para o teste com WhatsApp real.
import { attendanceSettingsSchema } from "../src/features/tracking-chat-ai/lib/capabilities";
import { isAiHeldBySection, isHumanReplyRecent } from "../src/features/org-defaults/lib/attendance/ai-hold";
import type { SectionState } from "../src/features/org-defaults/lib/attendance/section";

let failures = 0;
function check(label: string, isOk: boolean) {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}`);
}

const MINUTE_MS = 60_000;
const now = new Date("2026-10-21T14:30:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * MINUTE_MS);
const aiFirst = attendanceSettingsSchema.parse({ firstResponder: "AI" });
const teamFirst = attendanceSettingsSchema.parse({ firstResponder: "TEAM" });
const openSection = (patch: Partial<SectionState>): SectionState => ({
  status: "open",
  openedAt: minutesAgo(60).toISOString(),
  openReason: "client_message",
  lastActivityAt: minutesAgo(1).toISOString(),
  ...patch,
});

check("CA-R1: atendente falou há 5 min, a IA fica calada", isHumanReplyRecent(minutesAgo(5), now, aiFirst.inServiceAiMinutes));
check("CA-R2: atendente falou há 11 min, a IA volta a responder", !isHumanReplyRecent(minutesAgo(11), now, aiFirst.inServiceAiMinutes));
check("CA-R2: no limite exato do prazo a IA já responde", !isHumanReplyRecent(minutesAgo(10), now, aiFirst.inServiceAiMinutes));
check("CA-R7: lead antigo, sem resposta humana registrada, a IA responde", !isHumanReplyRecent(null, now, aiFirst.inServiceAiMinutes));
check("CA-R2: prazo do funil vale (30 min)", isHumanReplyRecent(minutesAgo(20), now, 30));

check("RF-8: Equipe primeiro, ninguém falou ainda, a IA espera", isAiHeldBySection(openSection({ awaitingSince: minutesAgo(1).toISOString() }), teamFirst));
check(
  "RF-8: Equipe primeiro, a IA assumiu depois do prazo, ela responde",
  !isAiHeldBySection(openSection({ awaitingSince: minutesAgo(9).toISOString(), aiStepInAt: minutesAgo(1).toISOString() }), teamFirst),
);
check(
  "RF-9: Equipe primeiro, o atendente já falou nesta seção, a regra da seção não segura",
  !isAiHeldBySection(openSection({ lastHumanAt: minutesAgo(40).toISOString() }), teamFirst),
);
check("RF-7: IA primeiro, a seção nunca segura a IA", !isAiHeldBySection(openSection({ awaitingSince: minutesAgo(1).toISOString() }), aiFirst));
check("RF-11: cliente pediu humano, a IA espera o consultor", isAiHeldBySection(openSection({ humanRequestedAt: minutesAgo(2).toISOString() }), aiFirst));
check(
  "RF-11: a IA voltou depois do pedido de humano, ela responde",
  !isAiHeldBySection(openSection({ humanRequestedAt: minutesAgo(12).toISOString(), aiStepInAt: minutesAgo(2).toISOString() }), aiFirst),
);

console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
process.exit(failures === 0 ? 0 : 1);
