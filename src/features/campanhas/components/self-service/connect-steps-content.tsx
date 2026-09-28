// Conteúdo dos passos "Meta" e "Cartão" do assistente, em linguagem de quem
// nunca abriu o painel da Meta (spec 0040, RF-3). Links conferidos em 2026-09.

import type { ReactNode } from "react";
import { CopyField } from "./copy-field";
import { GUIDE_STEPS } from "./guide-steps";
import { HowToSteps, type ChecklistItem } from "./guided-checklist";
import { WhereToPaste } from "./where-to-paste";

const FACEBOOK_LOGIN_URL = "https://www.facebook.com/login";
const FACEBOOK_SIGNUP_URL = "https://www.facebook.com/r.php";
const FACEBOOK_RECOVER_URL = "https://www.facebook.com/login/identify";
const BUSINESS_SELECT_URL = "https://business.facebook.com/select";
const BUSINESS_CREATE_URL = "https://business.facebook.com/overview";
const BUSINESS_PEOPLE_URL = "https://business.facebook.com/settings/people";

const ADMIN_REQUEST_MESSAGE =
  "Oi! Preciso conectar o WhatsApp oficial da empresa na ÓRBITA. Você pode me adicionar como administrador (acesso total) no cadastro da empresa na Meta? É em business.facebook.com → Configurações → Pessoas → Adicionar. Obrigado!";

export function buildMetaChecklist(params: {
  connectAction: ReactNode;
  smsCode: ReactNode;
  isConnected: boolean;
  isEmbeddedSignupConfigured: boolean;
}): ChecklistItem[] {
  return [
    {
      id: "facebook",
      title: "Entre no seu Facebook",
      summary: (
        <p>
          É o mesmo Facebook pessoal que você já usa. A Meta (dona do WhatsApp) pede isso só para saber <strong>quem</strong> está
          conectando o número — nada é publicado no seu perfil.
        </p>
      ),
      links: [
        { label: "Entrar no Facebook", href: FACEBOOK_LOGIN_URL, isPrimary: true },
        { label: "Não tenho Facebook", href: FACEBOOK_SIGNUP_URL },
      ],
      howTo: (
        <HowToSteps
          steps={[
            "Clique em \"Entrar no Facebook\" — abre numa aba nova.",
            "Digite o e-mail ou celular e a senha que você usa no Facebook.",
            <>
              Esqueceu a senha?{" "}
              <a href={FACEBOOK_RECOVER_URL} target="_blank" rel="noreferrer" className="underline">
                Recupere aqui
              </a>
              .
            </>,
            "Não tem conta? Clique em \"Não tenho Facebook\" e crie em 2 minutos.",
            "Deixe a aba aberta e volte para esta tela.",
          ]}
        />
      ),
      doneLabel: "Já entrei",
    },
    {
      id: "business",
      title: "Cadastre sua empresa na Meta",
      summary: (
        <p>
          A Meta chama o cadastro da sua empresa de <strong>&quot;portfólio empresarial&quot;</strong> (ou &quot;Gerenciador de
          Negócios&quot;). É grátis e leva uns 2 minutos. Se você já anuncia no Instagram ou Facebook, provavelmente já tem um.
        </p>
      ),
      links: [
        { label: "Ver se já tenho", href: BUSINESS_SELECT_URL, isPrimary: true },
        { label: "Criar agora", href: BUSINESS_CREATE_URL },
      ],
      howTo: (
        <HowToSteps
          steps={[
            "Clique em \"Ver se já tenho\". Se aparecer o nome da sua empresa na lista, você já tem — pode marcar \"Já fiz\".",
            "Se a lista estiver vazia, clique em \"Criar agora\" e depois em \"Criar uma conta\".",
            "Preencha o nome da empresa (o mesmo do CNPJ), seu nome e o e-mail da empresa.",
            "Clique em Enviar e confirme o e-mail que a Meta mandar.",
          ]}
        />
      ),
      doneLabel: "Já tenho",
    },
    {
      id: "admin",
      title: "Confira se você é administrador",
      summary: (
        <p>
          Só quem é <strong>administrador</strong> do cadastro da empresa consegue conectar o WhatsApp. Quem criou o cadastro já é.
        </p>
      ),
      links: [{ label: "Ver quem é administrador", href: BUSINESS_PEOPLE_URL, isPrimary: true }],
      howTo: (
        <div className="space-y-3">
          <HowToSteps
            steps={[
              "Clique em \"Ver quem é administrador\".",
              "Procure seu nome na lista de Pessoas.",
              "Se estiver escrito \"Acesso total\" (ou \"Administrador\") ao lado, está tudo certo.",
              "Se não aparecer seu nome, peça para quem criou te adicionar — copie a mensagem abaixo e mande para essa pessoa.",
            ]}
          />
          <CopyField label="Mensagem pronta para pedir acesso" value={ADMIN_REQUEST_MESSAGE} isMultiline />
        </div>
      ),
      doneLabel: "Sou administrador",
    },
    {
      id: "whatsapp",
      title: "Conecte o WhatsApp",
      summary: params.isEmbeddedSignupConfigured ? (
        <p>
          Clique em <strong>Conectar via Meta</strong>, logo abaixo. A Meta abre uma janela própria, onde você confirma sua empresa
          e o número. Quando terminar, este passo fica verde sozinho.
        </p>
      ) : (
        <p>Este passo a nossa equipe faz junto com você, em poucos minutos.</p>
      ),
      action: (
        <div className="space-y-3">
          {params.connectAction}
          {params.smsCode}
        </div>
      ),
      howTo: params.isEmbeddedSignupConfigured ? (
        <div className="space-y-3">
          <HowToSteps
            steps={[
              "Clique em \"Conectar via Meta\". Se nada abrir, o navegador bloqueou: clique no ícone de janela bloqueada na barra de endereço, escolha \"Sempre permitir\" e clique de novo.",
              "Na janela da Meta, clique em \"Continuar como (seu nome)\".",
              "Escolha a empresa que você cadastrou no passo 2.",
              "Em conta do WhatsApp, escolha \"Criar nova conta\". Coloque o nome que o cliente vai ver (ex.: o nome da loja) e a categoria.",
              "Digite o número com DDD e escolha receber o código por SMS.",
              "Copie o código de 6 dígitos (se comprou o número aqui, ele aparece nesta tela) e cole na janela da Meta.",
              "Clique em Concluir. Esta tela fica verde sozinha.",
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <WhereToPaste step={GUIDE_STEPS.metaLogin} />
            <WhereToPaste step={GUIDE_STEPS.metaBusiness} />
            <WhereToPaste step={GUIDE_STEPS.smsCode} />
          </div>
        </div>
      ) : undefined,
      isAutoDone: params.isConnected,
      isManualDoneHidden: true,
    },
  ];
}

export function buildCardChecklist(params: { paymentMethodsUrl: string }): ChecklistItem[] {
  return [
    {
      id: "open-billing",
      title: "Abra a área de pagamentos da Meta",
      summary: (
        <p>
          A Meta cobra as mensagens <strong>direto no cartão da sua empresa</strong>, todo mês. Sem cartão cadastrado, as campanhas
          não saem. A ÓRBITA não vê nem guarda os dados do cartão.
        </p>
      ),
      links: [{ label: "Abrir pagamentos da Meta", href: params.paymentMethodsUrl, isPrimary: true }],
      howTo: (
        <HowToSteps
          steps={[
            "Clique em \"Abrir pagamentos da Meta\" — abre numa aba nova.",
            "Se a Meta pedir, escolha a empresa que você cadastrou.",
            "Você vai cair na tela \"Configurações de pagamento\".",
          ]}
        />
      ),
      doneLabel: "Abri",
    },
    {
      id: "add-card",
      title: "Adicione o cartão da empresa",
      summary: <p>Crédito ou débito com função crédito. Prefira o cartão da empresa (CNPJ).</p>,
      howTo: (
        <div className="space-y-3">
          <HowToSteps
            steps={[
              "Clique em \"Adicionar forma de pagamento\".",
              "Escolha \"Cartão de crédito ou débito\".",
              "Preencha número, validade e código de segurança e clique em Salvar.",
              "Se a Meta perguntar a moeda, escolha Real (BRL).",
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <WhereToPaste step={GUIDE_STEPS.billingHub} />
            <WhereToPaste step={GUIDE_STEPS.addCard} />
          </div>
        </div>
      ),
      doneLabel: "Cartão cadastrado",
    },
  ];
}
