---
id: 0073
titulo: "Errou" no WhatsApp e painel de correções do ASTRO
dominio: astro-bot
status: implementada
autor: Weydson
criada: 2026-10-07
atualizada: 2026-10-07
branch: feature/W-astro-whatsapp-intencao-e-contexto-20261006
pr: https://github.com/Act962/nasa.ex/pull/437
peso: completa
---

# 0073 — "Errou" no WhatsApp e painel de correções do ASTRO

## 1. Contexto

Os seis erros da spec 0072 só chegaram à equipe porque o usuário tirou um print da conversa. Não há caminho para o usuário dizer "isso está errado", nem lugar onde a equipe veja onde o ASTRO mais erra. Os erros eram de código, iguais para todo cliente — nenhum se resolveria com memória por empresa.

## 2. Objetivo

O usuário avisa o erro na própria conversa, em uma palavra, e a equipe vê pedido, resposta e "o certo" num painel, agrupados pela camada que respondeu.

### Não-objetivos

- O ASTRO **não** muda de comportamento sozinho a partir da correção. Quem corrige é a equipe, pelo fluxo normal de PR.
- Desfazer o que a resposta errada gravou (demanda criada, lançamento).
- Memória de preferências por empresa ou por usuário.
- Botão de "errou" no widget do chat (o modelo já tem `channel` para isso).
- Avisar o usuário quando a correção for marcada como corrigida.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Mensagem **inteira** igual a "errou", "errado", "tá errado", "você errou", "não era isso", "não foi isso", "resposta errada" ou 👎 registra a última resposta do ASTRO naquele número como erro e pergunta o que era o certo. |
| RF-2 | "errou: <texto>" registra o erro e o certo numa mensagem só, sem pergunta. |
| RF-3 | Depois da pergunta, a próxima mensagem do usuário (em até 10 min) é gravada como "o certo" — mesmo que comece com verbo. "pular" encerra sem texto. A confirmação repete o que foi gravado. |
| RF-4 | O registro guarda: pedido, resposta, camada que respondeu (`toolsCalled[0]`), e os últimos 6 turnos dos últimos 30 min. |
| RF-5 | Avisar o erro por texto não cobra Stars. Por áudio, cobra só a transcrição (ela acontece antes de sabermos o que foi dito). |
| RF-6 | Registrar o erro encerra a pergunta do roteiro que estava no ar — ela pertencia à resposta errada. |
| RF-7 | Os turnos do "errou" entram no log do bot com status `feedback` e ficam fora da memória de conversa do modelo. |
| RF-8 | Painel em `/admin/astro-correcoes`, só para admin do sistema: abas Abertas / Corrigidas / Descartadas; em Abertas, contagem por camada que respondeu, clicável como filtro; cada item mostra empresa, usuário, data, pedido, resposta, o certo e a conversa. |
| RF-9 | No painel, a equipe marca como Corrigido (com anotação opcional) ou Descartar, e pode Reabrir. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Falha no fluxo do "errou" (inclusive tabela ainda não migrada) nunca derruba o bot: a mensagem segue o caminho normal. |
| RNF-2 | O painel não expõe nada a quem não é admin do sistema (`requireAdminMiddleware`). |

## 4. Critérios de aceite

- [x] **CA-1** — "errou", "Errou!", "não era isso", "👎" são aviso de erro; "o cliente errou o endereço" e "errou feio no relatório de ontem" não são. _(`scripts/verify-astro-whatsapp-intent.ts`)_
- [x] **CA-2** — "errou: o título era o texto inteiro entre aspas" separa o certo do aviso. _(idem)_
- [x] **CA-3** — "pular" e "não sei" são reconhecidos como pular. _(idem)_
- [ ] **CA-4** — Pelo WhatsApp: pedido → resposta → "errou" → o ASTRO cita a resposta e pergunta o certo → texto → aparece em Abertas com os três campos e a conversa. _Manual, depois da migration._
- [ ] **CA-5** — "errou" sem nenhuma resposta nos últimos 30 min pede o relato em uma mensagem começando com "errou:". _Manual._
- [ ] **CA-6** — Marcar como Corrigido tira de Abertas e mostra em Corrigidas com a anotação; Reabrir devolve. _Manual._
- [ ] **CA-7** — Usuário que não é admin do sistema recebe recusa em `admin.astroCorrections.list`. _Manual._

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | "errou" duas vezes seguidas | A segunda não cria registro novo; repete a pergunta. |
| CB-2 | Depois da pergunta, o usuário manda um pedido novo em vez do certo | É gravado como "o certo"; a confirmação mostra o texto e diz para mandar de novo se era pedido. Aceito de propósito (D-2). |
| CB-3 | Passaram mais de 10 min sem responder à pergunta | O registro fica com "aguardando" no painel e a próxima mensagem segue normal. |
| CB-4 | "errou" enquanto o roteiro espera resposta (ex.: lista de workspaces) | Vale o aviso; o roteiro é encerrado. |
| CB-5 | Usuário ou empresa removidos depois | O registro continua; o painel mostra "Usuário removido" / "Empresa removida". |
| CB-6 | Tabela ainda não existe no banco | Aviso no log, bot responde como antes; o painel mostra erro de carregamento. |

## 6. Decisões de design

### D-1 — O ASTRO não aprende sozinho com a correção

Correção de um usuário valer para todos deixaria um cliente "ensinar errado" aos outros e abriria caminho para instrução vinda de fora virar regra. A correção é sinal para a equipe; a mudança passa por PR e revisão.

### D-2 — A mensagem seguinte à pergunta é sempre "o certo"

A alternativa era tentar distinguir resposta de pedido novo. Mas a explicação do certo costuma começar com verbo ("criar com o título inteiro") — e tratá-la como pedido faria o ASTRO executar de novo justamente o que errou. Gravar a mais custa uma linha no painel; executar a mais custa um registro errado no banco do cliente.

### D-3 — Sem chave estrangeira para empresa e usuário

É registro de auditoria: precisa sobreviver à saída do membro. O painel resolve os nomes na leitura.

### D-4 — Agrupar pela camada que respondeu, não por texto

`toolsCalled[0]` (`verbo`, `consulta:tracking.leads_filtered`, `confirmacao`, nome de tool) já diz qual parte do código responder. Agrupar por semelhança de texto exigiria modelo e erraria mais.

## 7. Modelo de dados

Tabela nova `astro_correction` (model `AstroCorrection`), só aditiva — migration `20261007120000_astro_corrections`. Aplicada pelo deploy (entrypoint do container); **não** foi executada à mão em banco nenhum.

## 8. Segurança e privacidade

O registro copia trechos da conversa do cliente (nomes de leads, valores). Leitura restrita a admin do sistema; nada disso volta para o modelo nem para outras empresas.

## 9. Changelog

- 2026-10-07 — Criada e implementada.
