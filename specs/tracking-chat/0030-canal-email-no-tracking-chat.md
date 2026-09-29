---
id: 0030
titulo: Canal E-mail no Tracking Chat — ler e responder e-mails dos leads pelo Gmail da organização
dominio: tracking-chat
status: aprovada
autor: Weydson
criada: 2026-09-25
atualizada: 2026-09-25
branch: feature/W-astro-commander-20260925
pr:
peso: completa
---

# 0030 — Canal E-mail no Tracking Chat

Relacionadas:
- [0003](0003-tracking-chat-baseline.md): baseline do Tracking Chat.
- [0018](../payment/0018-caixa-de-entrada-gmail.md): caixa de entrada Gmail do financeiro. Mesma conexão, só leitura.

---

## 1. Contexto

Leads escrevem para o e-mail da empresa, e a equipe responde fora do ÓRBITA. O Tracking Chat só mostra WhatsApp e Instagram.

A conexão Gmail da organização já existe (`PlatformIntegration` com `platform: GMAIL`, uma por organização) e já pede os escopos `gmail.readonly` e `gmail.send`. Hoje só a leitura é usada, pelo financeiro, e só de metadados e anexos, não do corpo.

Junto veio uma limpeza: o filtro de canais mostrava Telegram, LinkedIn, Slack e outros sem integração real (com a URL do ícone impressa como texto) e o Messenger, que está incompleto.

## 2. Objetivo

No Tracking Chat, a equipe vê os e-mails trocados com os leads do tracking aberto e responde por ali mesmo — com assunto, título e corpo — pelo Gmail da organização, na mesma conversa (thread) do e-mail.

### Não-objetivos

- **Gravar e-mails no banco.** Decisão do usuário (D-1): lidos direto do Gmail ao abrir.
- **E-mail como mensagem da conversa do lead**, no histórico, na IA ou nos alertas do ASTRO. Depende de gravar (D-1).
- **Outras caixas** (Outlook, IMAP). Só a conexão Gmail que já existe.
- **Anexos na resposta.** Primeira versão envia texto.
- **Completar o Messenger.** Só escondido do filtro; o webhook segue igual.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O filtro de canais mostra só WhatsApp e Instagram (os que recebem de verdade) e o novo **E-mail**. Messenger, Telegram, TikTok, LinkedIn, Discord, Slack e Teams saem, no desktop e no celular. |
| RF-2 | O canal **E-mail** lista as conversas de e-mail (threads) do Gmail da organização com os leads **do tracking aberto**: e-mails recebidos deles ou enviados a eles, dos últimos 90 dias. |
| RF-3 | Cada item mostra o lead, o assunto, um trecho e a data. Abrir mostra a conversa inteira em ordem, com remetente, data e corpo em texto. |
| RF-4 | Responder envia pelo Gmail da organização, na mesma thread (`threadId` + `In-Reply-To`/`References`), com **assunto**, **título** (opcional, vira o cabeçalho do corpo) e **corpo**. |
| RF-5 | Também dá para escrever um **e-mail novo** para um lead do tracking que tenha e-mail. |
| RF-6 | Sem Gmail conectado, o canal E-mail abre um aviso com o atalho para conectar. |
| RF-7 | Cada ícone de canal mostra quantos leads estão **sem resposta** (última mensagem é do lead). No E-mail, conta leads cuja última mensagem da conversa é deles. |
| RF-8 | O ícone do E-mail é o logo do Gmail colorido quando a caixa da empresa está conectada, e cinza quando não está. |
| RF-10 | O ícone **Chat** do menu lateral mostra uma bolinha com a somatória de leads sem resposta de todos os canais e trackings da organização, atualizada a cada 30 s. |
| RF-9 | Canal **Chat do site** (In-Chat): leads que chegaram pelo link público do chat (`Lead.source = IN_CHAT`), com contador e o link para copiar. O filtro WhatsApp passa a excluir esses leads. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma migration. |
| RNF-2 | O corpo do e-mail é mostrado como **texto**, nunca HTML cru na página (evita script/rastreador de terceiro). |
| RNF-3 | Só o endereço de um lead do tracking recebe resposta por aqui: o destinatário é validado no servidor contra os leads do tracking. |
| RNF-4 | Lista limitada (até 50 leads com e-mail por consulta, 30 threads), para a busca no Gmail caber em uma consulta. |

## 4. Critérios de aceite

- [ ] **CA-1** — Com Gmail conectado e um lead do tracking que mandou e-mail para a organização, o canal E-mail lista essa conversa com o nome do lead e o assunto.
- [ ] **CA-2** — Abrir a conversa mostra todas as mensagens da thread, em ordem, com o corpo em texto.
- [ ] **CA-3** — Responder com assunto, título e corpo: o lead recebe a resposta na mesma conversa de e-mail dele, enviada pela conta da organização.
- [ ] **CA-4** — E-mail de alguém que não é lead do tracking não aparece.
- [ ] **CA-5** — Tentar enviar para um endereço que não é lead do tracking é recusado pelo servidor.
- [ ] **CA-6** — Sem Gmail conectado, o canal mostra o aviso com o atalho para conectar.
- [ ] **CA-7** — O filtro não mostra mais Messenger, Telegram, LinkedIn etc., nem o texto da URL do ícone.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Tracking sem nenhum lead com e-mail | Lista vazia com a explicação ("nenhum lead deste tracking tem e-mail"). |
| CB-2 | Mesmo e-mail em dois leads do tracking | A conversa aparece uma vez, com o lead mais recente. |
| CB-3 | Token do Gmail expirado ou revogado | Aviso para reconectar; nada é enviado. |
| CB-4 | Conexão Gmail sem o escopo `gmail.send` (conectada antes) | Leitura funciona; envio pede reconexão com mensagem clara. |
| CB-5 | E-mail só em HTML | Converte para texto (remove tags, preserva quebras). |
| CB-6 | Mais de 50 leads com e-mail no tracking | Consulta os 50 mais recentes; a lista avisa que é parcial. |
| CB-7 | Resposta a uma thread que não envolve lead do tracking | Recusada (RNF-3). |

## 6. Decisões de design

### D-1 — Ler direto do Gmail, sem gravar
- **Escolha:** decisão do usuário. Busca no Gmail ao abrir o canal.
- **Descartado (por ora):** sincronizar e gravar. Seria mais completo (histórico, IA, alertas), mas exige migration e sincronização em segundo plano.

### D-2 — Enviar pelo Gmail da organização, não pelo Resend
- **Escolha:** `users.messages.send` com a conta conectada.
- **Descartado:** Resend. Sairia de um domínio da Nasa, fora da thread do lead, e a resposta do lead não voltaria para a caixa da empresa.

### D-3 — Destinatário validado no servidor
- **Escolha:** o servidor confere que o destinatário é e-mail de um lead do tracking antes de enviar.
- **Motivo:** o canal envia pela conta da empresa; sem essa trava, vira um cliente de e-mail aberto para qualquer endereço.

## 7. Impacto

- [x] Procedures oRPC: `trackingChatEmail.threads`, `trackingChatEmail.thread`, `trackingChatEmail.send`.
- [x] Cliente Gmail: leitura de thread completa e envio (hoje só lê metadados).
- [ ] Schema: nenhum.
- [ ] Env vars: nenhuma.

## 8. Plano de testes

Sem runner de teste (CLAUDE.md, item 20). Manual, com uma conta Gmail de teste conectada:

| Critério | Como verificar |
| --- | --- |
| CA-1, CA-2, CA-4 | Enviar e-mail de um endereço de lead e de um que não é lead; abrir o canal. |
| CA-3, CA-5 | Responder pela tela; tentar enviar via procedure para endereço fora do tracking. |
| CA-6 | Organização sem Gmail. |
| CA-7 | Olhar o filtro com integrações marcadas no navegador. |

## 9. Riscos e rollback

- **Envio pela conta da empresa:** mitigado pela validação de destinatário (D-3).
- **Rollback:** remover o canal da tela. Não há dado gravado para desfazer.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-25 | Weydson | Criada |
| 2026-09-25 | Weydson | RF-10: bolinha no ícone Chat do menu lateral, com a somatória da organização (`conversation.unansweredTotal`). O ícone do Chat do site saiu do filtro de canais a pedido do usuário; o canal In-Chat continua atendido pela página pública. |
| 2026-09-29 | Weydson | CA-4 continua valendo para a leitura, mas a [0045](0045-email-de-remetente-novo-vira-lead.md) passa a transformar remetente novo em lead do funil escolhido — aí a conversa dele aparece aqui. |
| 2026-09-25 | Weydson | RF-7 a RF-9: contadores de sem resposta por canal, ícone do Gmail pelo status da conexão e canal Chat do site. In-Chat é identificado pela origem do lead, sem migration (a conversa segue gravada como WHATSAPP). |
