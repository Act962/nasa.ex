import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/enums";

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function callPollinationsJSON<T>(prompt: string, fallback: T): Promise<T> {
  const MODELS = ["openai", "openai-large", "mistral", "mistral-large"];
  for (const model of MODELS) {
    try {
      const resp = await fetchWithTimeout(
        "https://text.pollinations.ai/openai",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            jsonMode: true,
            messages: [
              { role: "system", content: "Você é um estrategista de marketing digital. Responda APENAS com JSON válido, sem markdown." },
              { role: "user", content: prompt },
            ],
          }),
        },
        60000,
      );
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => null);
      const text: string | undefined = data?.choices?.[0]?.message?.content ?? (typeof data === "string" ? data : undefined);
      if (!text?.trim()) continue;
      const clean = text.replace(/```json\n?|```\n?/g, "").trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : clean) as T;
    } catch {
      continue;
    }
  }
  return fallback;
}

function generateCompanyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NASA-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const onOnboardingFormsCompleted = inngest.createFunction(
  { id: "onboarding-forms-completed", name: "Onboarding: Formulários Concluídos" },
  { event: "onboarding/form.submitted" },
  async ({ event, step }) => {
    const { formId, onboardingProcessId, isBrandForm } = event.data as {
      formId: string;
      onboardingProcessId: string;
      isBrandForm: boolean;
    };

    // 1. Atualizar timestamp do form
    await step.run("update-form-stage", async () => {
      const data = isBrandForm
        ? { brandFormDoneAt: new Date(), stage: "BRAND_FORM_DONE" as const }
        : { onboardingDoneAt: new Date(), stage: "ONBOARDING_DONE" as const };
      await prisma.clientOnboardingProcess.update({ where: { id: onboardingProcessId }, data });
    });

    // 2. Verificar se ambos foram preenchidos
    const process = await step.run("check-both-complete", async () => {
      return prisma.clientOnboardingProcess.findUnique({ where: { id: onboardingProcessId } });
    });

    if (!process?.brandFormDoneAt || !process?.onboardingDoneAt) {
      return { waiting: true, message: "Aguardando o outro formulário ser preenchido" };
    }

    if (process.campaignId) {
      return { skipped: true, message: "Campanha já criada" };
    }

    // 3. Buscar respostas dos formulários
    const formResponses = await step.run("fetch-form-responses", async () => {
      const [brandResponses, onboardingResponses] = await Promise.all([
        process.brandFormId
          ? prisma.formResponses.findMany({ where: { formId: process.brandFormId }, orderBy: { createdAt: "desc" }, take: 1 })
          : Promise.resolve([]),
        process.onboardingFormId
          ? prisma.formResponses.findMany({ where: { formId: process.onboardingFormId }, orderBy: { createdAt: "desc" }, take: 1 })
          : Promise.resolve([]),
      ]);
      return {
        brand: brandResponses[0] ? JSON.parse(brandResponses[0].jsonResponse as string) : {},
        onboarding: onboardingResponses[0] ? JSON.parse(onboardingResponses[0].jsonResponse as string) : {},
      };
    });

    // 4. Buscar dados do OrgProject para contexto
    const orgProject = await step.run("fetch-org-project", async () => {
      if (!process.orgProjectId) return null;
      return prisma.orgProject.findUnique({ where: { id: process.orgProjectId }, select: { name: true, slogan: true } });
    });

    // 5. Gerar estrutura da campanha com IA (Pollinations)
    type AICampaign = {
      title: string;
      description: string;
      campaignType: string;
      tasks: Array<{ title: string; description: string }>;
      kickoffDate: string;
    };

    const aiCampaign = await step.run("call-pollinations-ai", async () => {
      const b = formResponses.brand;
      const o = formResponses.onboarding;
      const clientName = orgProject?.name ?? "Cliente";

      const prompt = `Com base nas informações abaixo, crie uma estrutura de campanha de marketing digital.

DADOS DO CLIENTE:
- Empresa: ${clientName}
${orgProject?.slogan ? `- Slogan: ${orgProject.slogan}` : ""}
${b.brand_slogan?.value || b.brand_slogan ? `- Slogan da marca: ${b.brand_slogan?.value ?? b.brand_slogan}` : ""}
${o.company_description?.value || o.company_description ? `- Descrição: ${o.company_description?.value ?? o.company_description}` : ""}
${o.market_scenario?.value || o.market_scenario ? `- Cenário de mercado: ${o.market_scenario?.value ?? o.market_scenario}` : ""}
${o.competitors?.value || o.competitors ? `- Concorrentes: ${o.competitors?.value ?? o.competitors}` : ""}
${o.objectives?.value || o.objectives ? `- Objetivos: ${o.objectives?.value ?? o.objectives}` : ""}
${o.kpis?.value || o.kpis ? `- KPIs: ${o.kpis?.value ?? o.kpis}` : ""}
${o.target_audience?.value || o.target_audience ? `- Público-alvo: ${o.target_audience?.value ?? o.target_audience}` : ""}
${o.budget?.value || o.budget ? `- Orçamento: ${o.budget?.value ?? o.budget}` : ""}
${o.timeline?.value || o.timeline ? `- Prazo: ${o.timeline?.value ?? o.timeline}` : ""}

Responda APENAS com este JSON:
{
  "title": "título da campanha",
  "description": "descrição em até 150 palavras",
  "campaignType": "captacao|vendas|lancamento|marca|educativo",
  "tasks": [
    {"title": "tarefa 1", "description": "descrição"},
    {"title": "tarefa 2", "description": "descrição"},
    {"title": "tarefa 3", "description": "descrição"}
  ],
  "kickoffDate": "YYYY-MM-DD"
}`;

      const fallback: AICampaign = {
        title: `Campanha — ${clientName}`,
        description: "Campanha criada automaticamente após onboarding do cliente.",
        campaignType: "captacao",
        tasks: [
          { title: "Definir identidade visual", description: "Revisar e aplicar materiais de marca" },
          { title: "Planejamento de conteúdo", description: "Definir calendário editorial do primeiro mês" },
          { title: "Configurar canais digitais", description: "Configurar redes sociais e ferramentas" },
        ],
        kickoffDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      };

      return callPollinationsJSON<AICampaign>(prompt, fallback);
    });

    // 6. Criar campanha no banco
    const { campaignId, companyCode } = await step.run("create-campaign", async () => {
      // Debit stars (best-effort)
      await debitStars(process.organizationId, 1, StarTransactionType.APP_CHARGE, "Campanha automática de onboarding", "nasa-planner", "system").catch(() => {});

      // Gerar company code único
      let code = generateCompanyCode();
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.nasaCampaignPlanner.findUnique({ where: { companyCode: code } });
        if (!exists) break;
        code = generateCompanyCode();
      }

      // Buscar owner para userId
      const member = await prisma.member.findFirst({ where: { organizationId: process.organizationId, role: "owner" }, select: { userId: true } });
      const userId = member?.userId ?? "";

      const kickoffDate = aiCampaign.kickoffDate ? new Date(aiCampaign.kickoffDate) : null;
      const endDate = kickoffDate ? new Date(kickoffDate.getTime() + 90 * 24 * 60 * 60 * 1000) : null;

      const campaign = await prisma.nasaCampaignPlanner.create({
        data: {
          organizationId: process.organizationId,
          userId,
          plannerId: process.plannerId ?? null,
          orgProjectId: process.orgProjectId ?? null,
          title: aiCampaign.title,
          description: aiCampaign.description,
          campaignType: aiCampaign.campaignType,
          companyCode: code,
          clientName: orgProject?.name ?? null,
          startDate: kickoffDate,
          endDate,
        },
      });

      await Promise.all([
        prisma.nasaCampaignOnboarding.create({ data: { campaignPlannerId: campaign.id, responsibleUserId: userId } }),
        prisma.nasaCampaignPublicAccess.create({ data: { campaignPlannerId: campaign.id, accessCode: code } }),
      ]);

      return { campaignId: campaign.id, companyCode: code };
    });

    // 7. Criar tarefas
    await step.run("create-tasks", async () => {
      if (!aiCampaign.tasks?.length) return;
      await prisma.nasaCampaignTask.createMany({
        data: aiCampaign.tasks.map((t) => ({
          campaignPlannerId: campaignId,
          title: t.title,
          description: t.description,
          priority: "HIGH",
          status: "PENDING",
        })),
      });
    });

    // 8. Criar evento de kickoff
    await step.run("create-kickoff-event", async () => {
      const kickoffDate = aiCampaign.kickoffDate ? new Date(aiCampaign.kickoffDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.nasaCampaignEvent.create({
        data: {
          campaignPlannerId: campaignId,
          eventType: "KICKOFF",
          title: "Reunião de Kickoff",
          description: "Alinhamento inicial com o cliente para início das atividades.",
          scheduledAt: kickoffDate,
          durationMinutes: 60,
          status: "SCHEDULED",
        },
      });
    });

    // 9. Salvar assets de marca no N-Box
    await step.run("save-brand-to-nbox", async () => {
      const b = formResponses.brand;
      const urlFields = ["logo_url", "brand_guidelines_link"];
      const member = await prisma.member.findFirst({ where: { organizationId: process.organizationId, role: "owner" }, select: { userId: true } });
      const userId = member?.userId;
      if (!userId) return;

      for (const field of urlFields) {
        const rawValue = b[field]?.value ?? b[field];
        const url = typeof rawValue === "string" ? rawValue.trim() : null;
        if (!url || !url.startsWith("http")) continue;
        const label = field === "logo_url" ? "Logo da marca" : "Manual de marca";
        const item = await prisma.nBoxItem.create({
          data: {
            organizationId: process.organizationId,
            type: "LINK",
            name: label,
            url,
            tags: ["public", "marca", "onboarding"],
            createdById: userId,
          },
        });
        await prisma.nasaCampaignBrandAsset.create({
          data: {
            campaignPlannerId: campaignId,
            nboxItemId: item.id,
            assetType: field === "logo_url" ? "LOGO" : "DOCUMENT",
            name: label,
            url,
          },
        });
      }
    });

    // 10. Finalizar processo de onboarding
    await step.run("finalize-onboarding", async () => {
      await prisma.clientOnboardingProcess.update({
        where: { id: onboardingProcessId },
        data: { campaignId, stage: "CAMPAIGN_CREATED", campaignCreatedAt: new Date() },
      });
    });

    return { campaignId, companyCode, status: "completed" };
  },
);
