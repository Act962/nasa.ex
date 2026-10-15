---
id: 0107
titulo: Disparar email para contatos selecionados, com modelos de email
dominio: campanhas
status: aprovada
autor: Claude (pedido do Weydson)
criada: 2026-10-15
atualizada: 2026-10-15
branch: feature/W-catalogo-venda-guiada-ajustes-teste-20261015
pr:
peso: leve
---

# 0107 — Disparar email e modelos de email

## 1. Contexto

Em /contatos, a barra de seleção só oferece "Disparar mensagens" (WhatsApp, pelas Campanhas). A carteira do ERP (spec 0106) traz milhares de clientes com e-mail, e o resgate de vendas e a cobrança precisam de um canal que não dependa de template da Meta nem da janela de 24h. Hoje o Órbita não tem modelo de email editável nem envio em massa por email.

## 2. Objetivo

Selecionar contatos em /contatos, clicar em "Disparar email", escolher um modelo e enviar. Os modelos são montados em Campanhas → "Modelos de email".

### Não-objetivos

- Domínio de envio próprio por empresa. O email sai pelo endereço da plataforma (`RESEND_FROM_EMAIL`), com o nome da empresa como remetente e resposta para quem disparou.
- Agendamento, teste A/B e editor visual de arrastar blocos.
- Abertura e clique por destinatário (fica para a fase de resgate, RF-13 da 0106).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | **Modelos de email** (`EmailTemplate`): nome, assunto, texto de prévia e corpo no editor de texto do Órbita (TipTap). Variáveis `{{nome}}`, `{{primeiro_nome}}`, `{{email}}` e `{{empresa}}`. Criar, editar, arquivar e "Enviar teste para mim". |
| RF-2 | **"Disparar email"** na barra de seleção de /contatos abre a janela de envio, com o nome da campanha e o modelo. Ela mostra quantos contatos têm email, quantos não têm e quantos pediram para não receber. |
| RF-3 | O envio cria `EmailCampaign` + `EmailCampaignRecipient` (um por email, sem repetir) e roda no Inngest em lotes de 100 (`resend.batch.send`). O remetente é "Nome da empresa \<RESEND_FROM_EMAIL\>" e a resposta vai para o email de quem disparou. |
| RF-4 | **Descadastro:** todo email leva um rodapé com o link "Não quero mais receber" (assinado por HMAC). O link grava `EmailUnsubscribe` e mostra a confirmação. Também vai o header `List-Unsubscribe`. Quem se descadastrou nunca mais recebe disparo daquela empresa. |
| RF-5 | Cada contato que recebeu ganha a tag `Email: <nome da campanha>` (mesma ideia da RF-10 da 0106), sem disparar fluxo, e um evento `email_sent` na Jornada. |
| RF-6 | Na tela de modelos: os últimos envios, com enviados, falhas e ignorados. |

## 4. Critérios de aceite

- [ ] **CA-1** — Criar o modelo com `{{primeiro_nome}}`, enviar o teste e receber o email com o primeiro nome de quem enviou.
- [ ] **CA-2** — Selecionar 3 contatos (um sem email): a janela mostra "2 com email", e o envio entrega 2.
- [ ] **CA-3** — Clicar em "Não quero mais receber": um novo disparo para esse email o marca como ignorado.
- [ ] **CA-4** — Quem recebeu ganha a tag `Email: <campanha>` e o evento na Jornada, e nenhum fluxo roda.
- [ ] **CA-5** — Usuário sem permissão de criar em Contatos não dispara (403).

## 5. Casos de borda

| # | Caso | Comportamento |
| --- | --- | --- |
| CB-1 | Dois leads com o mesmo email | Um envio só (único por campanha e email). |
| CB-2 | Email inválido | Ignorado, com o motivo. |
| CB-3 | Resend fora do ar no meio | O lote falha e o Inngest repete; o que já foi enviado não reenvia (status por destinatário). |
| CB-4 | Seleção grande (milhares) | Os ids vão no corpo da chamada (não na URL), com limite de 5.000 por disparo. |
| CB-5 | Modelo arquivado depois do disparo | A campanha guarda assunto e HTML no momento do envio. |

## 6. Segurança de dados e LGPD

- Só membros da empresa com permissão em **Contatos** (`canCreate` para disparar, `canEdit` para modelos). Os leads são conferidos como da empresa no servidor; id de outra empresa é ignorado.
- O link de descadastro é assinado (HMAC com `BETTER_AUTH_SECRET`) e não expõe o id do lead. A página pública só mostra o email mascarado.
- O corpo do modelo é HTML gerado do TipTap no servidor; as variáveis são escapadas antes de entrar no HTML.
- Envio em massa de marketing sem descadastro é proibido por lei e pelos provedores: o rodapé é obrigatório e não pode ser removido.

## 7. Impacto

- **Migration aditiva:** `EmailTemplate`, `EmailCampaign`, `EmailCampaignRecipient`, `EmailUnsubscribe`.
- **oRPC:** `campanhas.email.*`.
- **Inngest:** `campanhas-email-send`.
- **Rota pública:** `/email/descadastrar`.
- **Env:** reaproveita `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.

## 8. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-15 | Claude | Criada e implementada a pedido do Weydson ("inclua em /contatos o modo Disparar email e crie a parte de montar os modelos"). |
