import type { Metadata } from "next";
import { OrbitaLegalPage } from "@/features/legal/components/orbita-legal-page";
import { ORBITA_CONTACT_EMAIL } from "@/features/legal/lib/orbita-legal";
import {
  groupSubprocessorsByPurpose,
  listActiveSubprocessors,
  listPublishedApps,
} from "@/features/legal/lib/orbita-data-inventory";

// Fornecedores dependem das integrações ligadas no ambiente de produção.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Política de Privacidade — Órbita Hub",
  description: "Como o Órbita Hub trata os dados pessoais de usuários e dos contatos que eles gerenciam.",
};

export default function OrbitaPrivacyPage() {
  const publishedApps = listPublishedApps();
  const subprocessorGroups = groupSubprocessorsByPurpose(listActiveSubprocessors());
  const aiProviderNames =
    subprocessorGroups
      .find((group) => group.purpose === "artificial-intelligence")
      ?.subprocessors.map((subprocessor) => subprocessor.name)
      .join(", ") ?? "provedores de modelos de linguagem";

  return (
    <OrbitaLegalPage
      title="Política de Privacidade"
      intro="Esta política explica quais dados o Órbita Hub coleta, por que coleta, com quem compartilha e o que você pode exigir a respeito deles, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)."
      sections={[
        {
          title: "Quem somos e qual o nosso papel",
          paragraphs: [
            `O Órbita Hub é uma plataforma de gestão comercial composta hoje por ${publishedApps.length} apps: ${publishedApps.map((app) => app.name).join(", ")}.`,
            "Sobre os dados da sua conta (usuário e empresa), somos controladores. Sobre os dados dos seus leads e clientes que você cadastra ou recebe pela plataforma, somos operadores: tratamos esses dados apenas para executar o serviço, conforme as suas instruções.",
          ],
        },
        {
          title: "Dados que coletamos",
          paragraphs: ["Coletamos apenas o necessário para a plataforma funcionar:"],
          bullets: [
            "Conta: nome, e-mail, foto, senha (armazenada com hash) ou vínculo com login Google",
            "Empresa: nome da organização, membros, permissões e configurações",
            "Conteúdo que você cria: leads, conversas, notas, tarefas, arquivos, formulários e páginas",
            "Pagamentos: plano contratado e histórico de cobrança — dados de cartão ficam com o Stripe, não conosco",
            "Uso da plataforma: registros de acesso e ações, para segurança, auditoria e suporte",
            "Origem do acesso: parâmetros de campanha (UTM), página de entrada e código de parceiro indicador",
            "Navegação: eventos de uso e gravação de sessão, somente se você aceitar cookies de análise",
          ],
        },
        {
          title: "Para que usamos",
          paragraphs: [
            "Usamos os dados para manter sua conta, executar as funcionalidades contratadas, cobrar o plano, prestar suporte, prevenir fraude e abuso, melhorar o produto e cumprir obrigações legais e fiscais.",
            "Não vendemos dados pessoais e não os usamos para finalidade diferente das descritas aqui sem avisar você antes.",
          ],
        },
        {
          title: "Bases legais",
          paragraphs: [
            "Tratamos dados com base na execução do contrato (para prestar o serviço), no cumprimento de obrigação legal (fiscal e regulatória), no legítimo interesse (segurança, prevenção a fraude e melhoria do produto) e no consentimento (cookies de análise, publicidade e personalização, que você pode revogar a qualquer momento).",
          ],
        },
        {
          title: "Assistente ASTRO e inteligência artificial",
          paragraphs: [
            `O ASTRO e outras funções de IA enviam o conteúdo necessário para gerar cada resposta — sua mensagem e o contexto da tela ou do lead em questão — a provedores de modelos de linguagem (hoje: ${aiProviderNames}).`,
            "As conversas com o ASTRO ficam salvas na sua conta para você retomá-las. Não informe senhas nem dados de cartão no chat.",
          ],
        },
        {
          title: "Compartilhamento",
          paragraphs: [
            "Compartilhamos dados apenas com quem é indispensável para o serviço funcionar. Esta lista é gerada a partir das integrações ativas na plataforma:",
          ],
          bullets: [
            ...subprocessorGroups.map(
              (group) =>
                `${group.label}: ${group.subprocessors
                  .map((subprocessor) => `${subprocessor.name} — ${subprocessor.description}`)
                  .join(" · ")}`,
            ),
            "Autoridades públicas, quando houver obrigação legal ou ordem judicial",
          ],
        },
        {
          title: "Apps da plataforma e dados que cada um usa",
          paragraphs: [
            "Cada app trata os dados necessários para a função descrita. A lista acompanha o catálogo de apps publicados:",
          ],
          bullets: publishedApps.map((app) => `${app.name}: ${app.description}`),
        },
        {
          title: "Dados de terceiros que você coloca na plataforma",
          paragraphs: [
            "Ao cadastrar, importar ou receber contatos de leads e clientes, você declara que obteve esses dados de forma lícita e que tem base legal para tratá-los e comunicá-los — inclusive para disparos em massa no WhatsApp.",
            "Pedidos de titulares sobre esses dados devem ser atendidos por você, como controlador. Quando necessário, damos o apoio técnico para localizar, corrigir ou excluir os registros.",
          ],
        },
        {
          title: "Transferência internacional",
          paragraphs: [
            "Alguns fornecedores (infraestrutura, IA, análise e pagamentos) processam dados fora do Brasil. Nesses casos, escolhemos fornecedores que adotam salvaguardas contratuais e de segurança compatíveis com a LGPD.",
          ],
        },
        {
          title: "Por quanto tempo guardamos",
          paragraphs: [
            "Mantemos os dados enquanto sua conta estiver ativa. Depois do encerramento, excluímos ou anonimizamos o que não precisamos mais, preservando apenas o exigido pela legislação fiscal ou necessário para defesa em processo, pelo prazo legal.",
          ],
        },
        {
          title: "Seus direitos",
          paragraphs: [
            "A LGPD garante a você o direito de confirmar o tratamento, acessar os dados, corrigir dados incompletos ou desatualizados, pedir anonimização, bloqueio ou eliminação, solicitar portabilidade, saber com quem compartilhamos, revogar o consentimento e se opor a tratamentos feitos sem base legal.",
            `Para exercer qualquer um deles, escreva para ${ORBITA_CONTACT_EMAIL}. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
          ],
        },
        {
          title: "Segurança",
          paragraphs: [
            "Adotamos medidas técnicas e administrativas para proteger os dados, incluindo controle de acesso por permissão, criptografia de credenciais sensíveis e registro de atividades. Nenhum sistema é infalível: em caso de incidente relevante, comunicaremos os afetados e a ANPD conforme a lei exige.",
          ],
        },
        {
          title: "Cookies",
          paragraphs: [
            "Usamos cookies essenciais para manter sua sessão e cookies opcionais, que só valem com o seu consentimento. A lista completa e o painel para mudar sua escolha estão na Política de Cookies.",
          ],
        },
        {
          title: "Alterações desta política",
          paragraphs: [
            "Esta política acompanha a plataforma: quando um app, cookie ou fornecedor entra ou sai, as listas acima e a data no topo são atualizadas automaticamente, e a mudança aparece no histórico de alterações abaixo. Mudanças relevantes também são avisadas na plataforma ou por e-mail.",
          ],
        },
      ]}
    />
  );
}
