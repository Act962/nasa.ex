import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";

function generatePortalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CLI-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildBrandFormJson(clientName: string): string {
  return JSON.stringify([
    {
      id: "logo_url",
      blockType: "TextField",
      attributes: { label: "URL do logotipo", helperText: "Link direto para a imagem do logo (PNG, SVG)", required: false, placeholder: "https://..." },
    },
    {
      id: "primary_colors",
      blockType: "TextField",
      attributes: { label: "Cores primárias", helperText: "Ex: #7c3aed, #f43f5e", required: false, placeholder: "#000000" },
    },
    {
      id: "secondary_colors",
      blockType: "TextField",
      attributes: { label: "Cores secundárias", helperText: "Cores de apoio da marca", required: false, placeholder: "#ffffff" },
    },
    {
      id: "fonts",
      blockType: "TextField",
      attributes: { label: "Tipografia / Fontes", helperText: "Nome das fontes utilizadas", required: false, placeholder: "Inter, Montserrat..." },
    },
    {
      id: "brand_guidelines_link",
      blockType: "TextField",
      attributes: { label: "Manual de marca (link)", helperText: "Link para o manual ou guia visual", required: false, placeholder: "https://..." },
    },
    {
      id: "brand_slogan",
      blockType: "TextField",
      attributes: { label: "Slogan", helperText: `Slogan ou tagline de ${clientName}`, required: false, placeholder: "" },
    },
  ]);
}

function buildOnboardingFormJson(): string {
  return JSON.stringify([
    {
      id: "company_description",
      blockType: "TextArea",
      attributes: { label: "Descrição da empresa", helperText: "Fale sobre a empresa, o que faz, como funciona", required: true, placeholder: "" },
    },
    {
      id: "market_scenario",
      blockType: "TextArea",
      attributes: { label: "Cenário de mercado", helperText: "Como está o mercado em que sua empresa atua?", required: false, placeholder: "" },
    },
    {
      id: "competitors",
      blockType: "TextField",
      attributes: { label: "Principais concorrentes", helperText: "Liste os principais concorrentes", required: false, placeholder: "" },
    },
    {
      id: "objectives",
      blockType: "TextArea",
      attributes: { label: "Objetivos da parceria", helperText: "O que você espera alcançar?", required: true, placeholder: "" },
    },
    {
      id: "kpis",
      blockType: "TextField",
      attributes: { label: "KPIs esperados", helperText: "Ex: 100 leads/mês, 20% aumento de vendas", required: false, placeholder: "" },
    },
    {
      id: "target_audience",
      blockType: "TextArea",
      attributes: { label: "Público-alvo (ICP)", helperText: "Descreva o cliente ideal da sua empresa", required: false, placeholder: "" },
    },
    {
      id: "budget",
      blockType: "TextField",
      attributes: { label: "Orçamento disponível", helperText: "Investimento mensal previsto para marketing", required: false, placeholder: "" },
    },
    {
      id: "timeline",
      blockType: "TextField",
      attributes: { label: "Prazo esperado para resultados", helperText: "Ex: 3 meses, 6 meses", required: false, placeholder: "" },
    },
  ]);
}

export const onProposalPaid = inngest.createFunction(
  { id: "onboarding-proposal-paid", name: "Onboarding: Proposta Paga" },
  { event: "onboarding/proposal.paid" },
  async ({ event, step }) => {
    const { proposalId, organizationId, leadId, orgProjectId } = event.data as {
      proposalId: string;
      organizationId: string;
      leadId: string | null;
      orgProjectId: string | null;
    };

    // 1. Buscar lead
    const lead = await step.run("fetch-lead", async () => {
      if (!leadId) return null;
      return prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, name: true, email: true, phone: true },
      });
    });

    // 2. Garantir OrgProject
    const projectId = await step.run("ensure-org-project", async () => {
      if (orgProjectId) return orgProjectId;
      const clientName = lead?.name ?? "Cliente";
      const project = await prisma.orgProject.create({
        data: { organizationId, name: clientName, type: "client" },
      });
      // Vincular proposta ao projeto
      await prisma.forgeProposal.update({
        where: { id: proposalId },
        data: { orgProjectId: project.id },
      });
      return project.id;
    });

    // 3. Criar NasaPlanner
    const plannerId = await step.run("create-planner", async () => {
      const clientName = lead?.name ?? "Cliente";
      const existing = await prisma.nasaPlanner.findFirst({
        where: { organizationId, orgProjectId: projectId },
      });
      if (existing) return existing.id;
      const planner = await prisma.nasaPlanner.create({
        data: { organizationId, orgProjectId: projectId, name: `Planner — ${clientName}`, brandName: clientName },
      });
      return planner.id;
    });

    // 4. Owner da org para userId dos forms
    const ownerId = await step.run("fetch-owner", async () => {
      const member = await prisma.member.findFirst({
        where: { organizationId, role: "owner" },
        select: { userId: true },
      });
      return member?.userId ?? null;
    });

    if (!ownerId) return { error: "No org owner found" };

    // 5. Criar formulário de marca
    const brandFormId = await step.run("create-brand-form", async () => {
      const clientName = lead?.name ?? "Cliente";
      const shareUrl = `brand-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const form = await prisma.form.create({
        data: {
          userId: ownerId,
          organizationId,
          name: `Formulário de Marca — ${clientName}`,
          description: "Envie os materiais e informações visuais da sua marca",
          jsonBlock: buildBrandFormJson(clientName),
          published: true,
          content: "{}",
          shareUrl,
        },
      });
      return form.id;
    });

    // 6. Criar formulário de onboarding
    const onboardingFormId = await step.run("create-onboarding-form", async () => {
      const clientName = lead?.name ?? "Cliente";
      const shareUrl = `onboarding-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const form = await prisma.form.create({
        data: {
          userId: ownerId,
          organizationId,
          name: `Onboarding — ${clientName}`,
          description: "Alinhamento de expectativas e contexto da empresa",
          jsonBlock: buildOnboardingFormJson(),
          published: true,
          content: "{}",
          shareUrl,
        },
      });
      return form.id;
    });

    // 7. Gerar código do portal único
    const clientPortalCode = await step.run("generate-portal-code", async () => {
      let code = generatePortalCode();
      for (let i = 0; i < 10; i++) {
        const exists = await prisma.clientOnboardingProcess.findUnique({ where: { clientPortalCode: code } });
        if (!exists) break;
        code = generatePortalCode();
      }
      return code;
    });

    // 8. Criar registro de onboarding
    const onboardingProcessId = await step.run("create-onboarding-record", async () => {
      const kickoffLink: string | null = process.env.KICKOFF_CALENDAR_LINK ?? null;
      const onboardingProcess = await prisma.clientOnboardingProcess.create({
        data: {
          organizationId,
          orgProjectId: projectId,
          proposalId,
          leadId: leadId ?? null,
          plannerId,
          brandFormId,
          onboardingFormId,
          clientPortalCode,
          kickoffLink,
          stage: "PAYMENT_CONFIRMED",
          paymentConfirmedAt: new Date(),
        },
      });
      return onboardingProcess.id;
    });

    // 9. Enviar e-mail
    await step.run("send-email", async () => {
      if (!lead?.email) return { skipped: true };
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      const brandFormUrl = `${base}/submit-form/${brandFormId}`;
      const onboardingFormUrl = `${base}/submit-form/${onboardingFormId}`;
      const portalUrl = `${base}/portal/${clientPortalCode}`;
      const kickoffUrl = process.env.KICKOFF_CALENDAR_LINK ?? "";

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@nasaex.com",
        to: lead.email,
        subject: "Bem-vindo(a)! Próximos passos para começarmos 🚀",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#7c3aed">Olá, ${lead.name ?? ""}! 👋</h2>
            <p>Ficamos muito felizes em ter você conosco. Sua proposta foi aprovada e agora precisamos de algumas informações para darmos início ao trabalho.</p>
            <h3>📋 Formulários para preencher</h3>
            <p><a href="${brandFormUrl}" style="color:#7c3aed;font-weight:bold">1. Formulário de Identidade de Marca</a><br>
            Envie logos, cores, fontes e materiais visuais da sua marca.</p>
            <p><a href="${onboardingFormUrl}" style="color:#7c3aed;font-weight:bold">2. Formulário de Onboarding</a><br>
            Conte-nos sobre sua empresa, objetivos e expectativas.</p>
            ${kickoffUrl ? `<h3>📅 Agende sua reunião de Kickoff</h3><p><a href="${kickoffUrl}" style="color:#7c3aed;font-weight:bold">Clique aqui para agendar</a></p>` : ""}
            <h3>🌐 Seu portal do cliente</h3>
            <p>Acompanhe tudo o que estamos fazendo para você em tempo real:<br>
            <a href="${portalUrl}" style="color:#7c3aed;font-weight:bold">${portalUrl}</a></p>
            <p style="color:#888;font-size:12px;margin-top:32px">NASA — Resultados rápidos, organizados e transparentes.</p>
          </div>
        `,
      });
      return { sent: true, to: lead.email };
    });

    // 10. Atualizar stage para FORMS_SENT
    await step.run("update-stage-forms-sent", async () => {
      await prisma.clientOnboardingProcess.update({
        where: { id: onboardingProcessId },
        data: { stage: "FORMS_SENT", formsSentAt: new Date() },
      });
    });

    return { onboardingProcessId, clientPortalCode, brandFormId, onboardingFormId };
  },
);
