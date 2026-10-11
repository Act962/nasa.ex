---
id: 0095
titulo: Botões e listas só em número com API oficial
dominio: tracking-chat
status: aprovada
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr:
peso: leve
---

# 0095 — Botões e listas só em número com API oficial

## 1. Contexto

Número conectado fora da API oficial funciona fora dos termos do WhatsApp e pode ser restringido a qualquer momento. Botão e lista são recursos da API oficial: num número não oficial são mais um sinal de automação, e o WhatsApp já deixou de entregar esse tipo de mensagem (o código do menu de agendamento registra isso: medido três vezes, a mensagem com botões é aceita e não chega ao aparelho).

Hoje a plataforma envia botão e lista em número não oficial por três caminhos: menus salvos do atendimento (inclusive o menu do roteiro), passo "Enviar Mensagem" com botões nos fluxos e o envio manual pelo chat. O menu de agendamento por botões já sai como texto numerado nesses números.

Decisão do Weydson (2026-10-11): seguir a recomendação de mandar texto numerado em número não oficial, deixar claro para o usuário que botão é só para API oficial e bloquear a inserção em automações e no envio manual.

## 2. Objetivo

Em número não oficial nenhum botão ou lista é enviado: o menu sai como texto numerado, a resposta por número vale como o clique, e as telas dizem que botão é só para número com API oficial.

### Não-objetivos

- Mudar qualquer coisa em número oficial.
- Desligar fluxos ou menus que já existem: eles continuam rodando, com o menu em texto.
- O Astro que atende a equipe pelo WhatsApp da plataforma (`astro-bot/lib/uazapi-channel.ts`): já usa texto numerado e fica como está.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Tudo fica atrás de `NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY`. Desligada (o padrão), nada muda para ninguém |
| RF-2 | Menu salvo do atendimento (ferramenta da assistente e menu inicial do roteiro) em número não oficial: sai como texto, "1 – Opção", com a linha "Responda com o número da opção" |
| RF-3 | Passo "Enviar Mensagem" com botões num fluxo, em número não oficial: sai como o mesmo texto numerado. O fluxo não falha |
| RF-4 | Resposta do cliente com o número ("2", "2.", "opção 2") ou com o texto exato da opção vale como clique: aplica a tag da opção e dispara o que o clique dispararia |
| RF-5 | Envio manual de botões pelo chat em número não oficial: o painel some da tela e a rota recusa com a frase "Botões e listas só podem ser enviados em número com API oficial" |
| RF-6 | Editor de fluxo, funil com número não oficial: o tipo "Botões" fica bloqueado para escolha nova, com a explicação. Passo que já era de botões continua abrindo, com aviso de que sai como texto numerado |
| RF-7 | Diagnóstico do fluxo: passo de botões em número não oficial ganha o aviso "sai como lista numerada", sem virar erro, para não travar fluxo que já funciona |
| RF-8 | Aba "Botões" do Fluxo de atendimento, funil com número não oficial: aviso fixo de que os menus saem como texto numerado |

## 4. Critérios de aceite

- [ ] **CA-1** — Com a opção desligada, os três caminhos enviam botão em número não oficial como hoje.
- [ ] **CA-2** — O texto numerado traz o corpo, uma linha por opção na ordem do menu, o rodapé e a instrução de responder com o número.
- [ ] **CA-3** — "2", "2.", "opção 2", " 2 " e o texto exato da segunda opção resolvem para a segunda opção; "22", "olá" e número fora da lista não resolvem nada.
- [ ] **CA-4** — A resposta por número só vale para o menu enviado mais recente da conversa; depois de outra mensagem da empresa, "2" volta a ser texto comum.
- [ ] **CA-5** — A rota do envio manual recusa botão em número não oficial e aceita em número oficial.
- [ ] **CA-6** — Em número oficial nada muda nos três caminhos.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Menu com mais de 10 opções | Todas saem numeradas (texto não tem o limite da lista) |
| CB-2 | Cliente responde "2" sem menu pendente | Texto comum: vai para a assistente |
| CB-3 | Cliente responde o número de uma opção sem tag | Vale como escolha (a assistente recebe o texto da opção), sem tag |
| CB-4 | Fluxo com "Esperar o clique" | Só existe em número oficial; em não oficial o passo segue pela saída única, como hoje |
| CB-5 | Funil sem número conectado | Os bloqueios de tela não aparecem; o diagnóstico de "sem número" continua valendo |

## 6. Segurança

- A resposta por número é entrada do cliente: só resolve para uma opção que está gravada na mensagem enviada pela própria empresa, naquela conversa. Nenhum id vem do texto.
- A rota do envio manual confere o tipo do número no servidor: esconder o painel não é a proteção.
- Nenhum dado novo é exposto: as opções do menu já eram enviadas ao cliente.

## 7. Regras da Meta

- Número oficial: nada muda. Botões e listas continuam dentro dos limites da API (3 botões, 10 linhas, títulos curtos).
- Número não oficial: deixar de enviar mensagem interativa reduz o sinal de automação fora dos termos. A spec não torna o número não oficial "seguro": o risco de restrição continua, e a tela não promete o contrário.

## 9. Riscos e rollback

- Risco: cliente acostumado a tocar no botão passa a ter de digitar o número. É a troca aceita.
- Rollback: desligar `NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY`. Sem migration.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Criada e aprovada na conversa ("pode seguir com a recomendação… bloqueie para caso usuário opte por inserir em automações ou manual") |
| 2026-10-11 | Weydson | **Implementada, atrás de `NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY` (desligada por padrão).** `tracking-chat/lib/numbered-menu.ts` (texto numerado e leitura da resposta, puro) e `tracking-chat/lib/inbound/numbered-reply.ts` (a resposta só vale para o último menu enviado na conversa). Envio em texto: `tracking-chat-ai/server/tools/send-buttons.ts` (menus salvos e menu do roteiro), `tracking-executions/lib/send-buttons-to-lead.ts` e `tracking-executions/components/send-message/executor.ts` (fluxos). Resposta por número: `app/api/chat/webhook/route.ts`, no mesmo trecho que já aplicava a tag do clique. Bloqueios: `router/message/create-with-buttons.ts` recusa; o formulário do passo de mensagem desabilita "Menu de Botões" para escolha nova; diagnóstico `UNOFFICIAL_MENU_AS_TEXT` como aviso; aviso fixo na aba "Botões". Conferido: `scripts/verify-numbered-menu.ts` (22 verificações) e `scripts/verify-numbered-reply-db.ts` (8, no banco de desenvolvimento, com mensagens de teste apagadas no fim). **Achados**: o menu de agendamento por botões já saía como texto numerado em número não oficial; e o painel de envio manual de botões (`buttons-panel.tsx`) não está montado em nenhuma tela, então RF-5 ficou só na recusa da rota. **Não conferido**: envio real em um número não oficial (o funil de teste usa número oficial) e a resposta por número chegando pelo webhook de verdade |
