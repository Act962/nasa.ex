import type { Metadata } from "next";
import { LegalPage } from "@/features/trafego/components/public/legal-page";

export const metadata: Metadata = {
  title: "Termos de Serviço — trafeGO",
  description: "Condições de contratação do serviço de gestão de tráfego trafeGO.",
};

export default function TrafegoTermsPage() {
  return (
    <LegalPage
      title="Termos de Serviço"
      updatedAt="12 de setembro de 2026"
      intro="Estes termos regem a contratação do trafeGO, serviço de gestão de tráfego pago e disparos operado pela Órbita. Ao contratar, você declara que leu e concorda com as condições abaixo — em especial as seções sobre criativos e resultados."
      sections={[
        {
          title: "O que está incluso",
          paragraphs: [
            "O trafeGO é um serviço de execução e gestão de campanhas. Nosso trabalho é configurar, publicar, monitorar e otimizar a veiculação dentro da plataforma escolhida (Meta, Google ou WhatsApp Oficial).",
          ],
          bullets: [
            "Configuração da campanha, segmentação e estrutura de anúncios",
            "Publicação e acompanhamento durante o período contratado",
            "Ajustes de otimização ao longo da veiculação",
            "Relatório de desempenho no painel do cliente",
            "Criação e configuração da conta de anúncios (BM), quando contratada",
            "Aquisição e configuração do número na API Oficial do WhatsApp, quando contratada",
            "Correção de problemas na conta de anúncios e criação da página do Facebook, como parte do setup",
          ],
        },
        {
          title: "Responsabilidade pelo criativo e pela copy",
          paragraphs: [
            "Os criativos (imagens e vídeos) e os textos veiculados são fornecidos por você, o contratante. A Órbita não produz, não revisa artisticamente e não garante o desempenho do material enviado.",
            "O desempenho de uma campanha depende de forma determinante da qualidade do criativo, da clareza da oferta, do preço praticado, da concorrência do seu mercado e da capacidade do seu negócio de atender a demanda gerada. Esses fatores estão fora do nosso controle.",
            "Em outras palavras: nosso compromisso é entregar a veiculação corretamente configurada e otimizada. Não nos responsabilizamos pelo resultado comercial de um criativo que não comunica bem, de uma oferta pouco competitiva ou de um atendimento que não converte os contatos gerados.",
            "Podemos apontar problemas evidentes no material e sugerir melhorias, mas a decisão final sobre o que será veiculado é sua.",
            "Nossa plataforma faz uma verificação prévia do conteúdo contra as políticas de publicidade da Meta, do Google e do WhatsApp, e sinaliza o que costuma ser recusado. Essa verificação é um auxílio, não uma garantia de aprovação: a responsabilidade pelo produto anunciado, pela oferta e pelas alegações feitas é integralmente do contratante. Anúncio recusado por política de plataforma não gera devolução da taxa de serviço.",
          ],
        },
        {
          title: "Ausência de garantia de resultado",
          paragraphs: [
            "Não garantimos número de vendas, de leads, de mensagens, faturamento, custo por resultado ou retorno sobre investimento. Qualquer projeção, estimativa ou exemplo apresentado tem caráter ilustrativo e não constitui promessa.",
            "Campanhas de tráfego pago envolvem leilão, sazonalidade e comportamento de audiência. Resultados obtidos por outros anunciantes não são indicativo do que você vai obter.",
          ],
        },
        {
          title: "Verba de tráfego e taxa de serviço",
          paragraphs: [
            "O valor pago se divide em verba de tráfego e taxa de serviço, discriminadas no momento da contratação. A verba é integralmente aplicada na plataforma de anúncios; a taxa remunera o nosso trabalho.",
            "A verba é consumida pela plataforma conforme a veiculação e não é reembolsável após o início da campanha. A taxa de serviço remunera a execução e também não é reembolsável depois que a campanha entra em análise pela equipe.",
            "O pagamento pode ser feito por cartão de crédito, com confirmação automática, ou por PIX. No PIX, o pagamento é conferido manualmente pela nossa equipe em horário comercial: a campanha só entra na fila depois dessa confirmação, e a cobrança tem validade informada no momento da contratação. Eventual reembolso de pagamento por PIX é feito para a mesma titularidade (CPF ou CNPJ) que originou a transferência.",
            "A taxa de setup, quando aplicável, é cobrada uma única vez. No tráfego pago, cobre a criação e configuração da conta de anúncios (BM) no seu nome; no disparo por WhatsApp, cobre a aquisição do número e a habilitação dele na API Oficial da Meta.",
            "A produção de criativos (imagens, vídeos e artes) não está incluída na taxa de serviço nem no setup. É um serviço à parte, orçado sob demanda.",
          ],
        },
        {
          title: "Conta de anúncios e propriedade",
          paragraphs: [
            "Quando criamos a conta de anúncios (BM) para você, ela é registrada em seu nome e permanece sua, inclusive o histórico, os públicos e o aprendizado acumulado. Recebemos acesso de operação enquanto durar a prestação do serviço.",
            "Se você já possui conta própria, solicitaremos acesso. A responsabilidade por manter a conta em conformidade com as políticas da plataforma é do titular.",
          ],
        },
        {
          title: "Políticas das plataformas e reprovações",
          paragraphs: [
            "Meta, Google e WhatsApp têm políticas próprias de publicidade e podem reprovar anúncios, restringir contas ou suspender veiculações a seu exclusivo critério, sem aviso e sem justificativa detalhada.",
            "Reprovações causadas pelo conteúdo do material enviado — produto restrito, promessa proibida, imagem em desacordo com as regras — são de responsabilidade do contratante. Vamos apontar o motivo e orientar a correção, mas o tempo perdido e a verba já consumida não são reembolsáveis.",
          ],
        },
        {
          title: "Prazos",
          paragraphs: [
            "Após a confirmação do pagamento e o envio completo dos materiais, a equipe analisa o pedido e coloca a campanha no ar. O prazo depende da fila de execução, da aprovação da plataforma e da completude do material recebido.",
            "Materiais incompletos, fora de especificação ou que exijam correção suspendem a contagem até a regularização.",
            "A data realista de início apresentada na contratação, quando reconhecida pelo contratante, integra estes termos: ela considera o preparo da conta, a vinculação das redes e o envio dos materiais, e não constitui promessa de aprovação do anúncio pela plataforma.",
            "No disparo pela API Oficial do WhatsApp, o volume diário de envio é definido pela Meta e começa limitado em números novos, aumentando de forma progressiva conforme a qualidade das interações. Não é possível disparar para toda a base logo no primeiro envio, e esse ritmo não depende da Órbita.",
          ],
        },
        {
          title: "Cancelamento e reembolso",
          paragraphs: [
            "Antes de a campanha entrar em análise pela equipe, o cancelamento pode ser solicitado com reembolso da taxa de serviço e da verba não utilizada.",
            "Depois que a campanha entra no ar, a verba já consumida pela plataforma e a taxa de serviço do período executado não são reembolsáveis.",
            "O direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor é observado nos sete dias seguintes à contratação, desde que a execução ainda não tenha se iniciado.",
          ],
        },
        {
          title: "Suporte",
          paragraphs: [
            "O atendimento acontece pelo painel do cliente e pelos canais informados na contratação, em dias úteis. Pedidos que ampliem o escopo contratado podem ser orçados à parte.",
          ],
        },
        {
          title: "Alterações destes termos",
          paragraphs: [
            "Podemos revisar estes termos. A versão aceita no momento da sua contratação é a que vale para o seu pedido, e fica registrada junto com a data do aceite.",
          ],
        },
      ]}
    />
  );
}
