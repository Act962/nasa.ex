---
id: 0112
titulo: Lembretes que param quando o cliente responde e paridade do Modo Agente com o modo normal
dominio: workflows
status: em-revisao
autor: Weydson (com Claude)
criada: 2026-10-16
atualizada: 2026-10-16
branch: feature/W-gatilhos-followup-janela-24h-20261016
pr:
peso: leve
---

# 0112 — Lembretes que param quando o cliente responde

## 1. Contexto

A Pleno Car quer insistir com quem demonstrou interesse no curso e não comprou: lembretes em
5 min, 30 min, 1 h, 4 h, 10 h e 18 h (dentro da janela de 24 h do WhatsApp oficial, mensagem
livre) e depois modelos aprovados em 28 h, 2, 5, 7 e 15 dias. Montar isso nos Gatilhos esbarrou
em três falhas, conferidas em produção em 16/10/2026:

1. **"Mensagem Recebida" só dispara fluxo em Modo Agente** (`dispatchToMatchingWorkflows` filtra
   `agentMode: true`). Os 7 fluxos "Curso: …" da Pleno Car estão no motor clássico com esse
   gatilho e **nunca rodaram** — inclusive o de follow-up de 1/5/7/15 dias e o do "SAIR".
2. **"Filtrar Leads" não tem executor no Modo Agente.** O editor oferece o passo, mas o motor
   devolve `Sem executor registrado pro NodeType FILTER_LEAD` e o caminho morre. Sem ele não há
   como conferir etiqueta (comprou, pediu para sair) antes de cada lembrete.
3. **"Esperar" em horas, dias ou semanas não espera no Modo Agente.** A janela do editor grava
   `{ type: "HOURS", hours: 3 }` (maiúsculo); o motor só reconhece minúsculo e cai em
   `action.minutes`, que não existe → "WAIT com tempo zero — seguindo direto".

E não havia condição para "o cliente respondeu desde que o fluxo começou", que é o que faz a
sequência parar quando ele volta a conversar.

## 2. Objetivo

Um fluxo de lembretes em Modo Agente (Mensagem Recebida → Esperar → Filtrar → Enviar, repetido)
funciona: espera o tempo pedido, para quando o cliente responde, comprou ou pediu para sair, e
recomeça a contagem a partir da nova mensagem dele.

### Não-objetivos

- Horário de silêncio (não mandar de madrugada). Fica para outra spec, se pedido.
- Converter automaticamente os fluxos clássicos com "Mensagem Recebida" para Modo Agente.
- Fazer fluxo do modo normal com gatilho exclusivo do Modo Agente ("Mensagem Recebida",
  "Pagamento Recebido") passar a rodar sozinho: fluxos assim que nunca rodaram começariam a
  mandar mensagem de surpresa, em qualquer empresa. A conversão é feita fluxo a fluxo.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | "Filtrar Leads" roda no Modo Agente com as mesmas condições do motor clássico, lendo o lead (etiquetas, coluna, valor, interesse) na hora em que o passo roda. |
| RF-2 | Filtro não satisfeito no Modo Agente encerra aquele caminho sem marcar erro (saída `filtered`, sem ligação). |
| RF-3 | Nova condição **Resposta do lead**: "não escreveu desde o início" / "escreveu desde o início", comparando a mensagem mais recente do cliente na conversa com a mensagem que disparou o fluxo. Vale nos dois motores. |
| RF-4 | No Modo Agente, "Mensagem Recebida" passa a alimentar as condições de mensagem (texto e id) do filtro. |
| RF-6 | **Paridade**: todo passo que o motor clássico executa roda no Modo Agente com o mesmo `data` gravado pela janela do editor. Passo clássico sem versão própria no Modo Agente (Temperatura, Responsável, Ganho/Perda, Requisição HTTP, Enviar Formulário/Agenda/Linnker/N-Box/Route, Abrir Formulário) roda pelo próprio executor clássico; passo novo do modo normal entra automaticamente. |
| RF-7 | Passos com versão própria no Modo Agente fazem no mínimo o que o modo normal faz: **Enviar Mensagem** aceita as variáveis da janela (`{{nome}}`, `{{status}}`, `{{sei_*}}`…), envia imagem, documento e para outro número (pelo envio do modo normal), barra texto de exemplo, confere a janela de 24 h e cobra Stars também nos botões, e envia com a IA pausada no lead; **Tag** ignora etiqueta arquivada ou apagada e atualiza o quadro; **Mover Lead** devolve o lead na coluna nova aos passos seguintes; **Proposta** e **Contrato** usam o que a janela do editor gravou (antes valia o `action` antigo, e o Contrato podia pegar um modelo qualquer). |
| RF-5 | "Esperar" no Modo Agente aceita o formato da janela do editor (maiúsculo): minutos e horas como duração; dias, semanas e meses com a hora do dia escolhida (fuso de São Paulo), igual ao motor clássico. O formato minúsculo dos modelos prontos e do ASTRO segue como duração pura. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A checagem de resposta é uma consulta indexada (`Message` por conversa e data) e só roda quando o filtro tem a condição. |

## 4. Critérios de aceite

- [ ] **CA-1** — Fluxo em Modo Agente com "Filtrar Leads (etiqueta não contém Comprou)": lead com a etiqueta para ali; lead sem ela segue.
- [ ] **CA-2** — Cliente manda "oi" e fica quieto: depois do Esperar, "Resposta do lead não escreveu desde o início" passa e o lembrete sai.
- [ ] **CA-3** — Cliente manda "oi" e, antes do fim da espera, manda "tudo bem?": o fluxo do "oi" para no filtro; o do "tudo bem?" segue com a contagem nova.
- [ ] **CA-4** — Cliente manda 3 fotos no mesmo segundo: só o fluxo da última segue (sem lembrete triplicado).
- [ ] **CA-5** — "Esperar 3 horas" feito na janela do editor, em Modo Agente, suspende o fluxo por 180 min (antes seguia direto).
- [ ] **CA-6** — "Esperar 1 dia às 10:00" (editor) no Modo Agente segue no dia seguinte às 10:00 de São Paulo.
- [ ] **CA-7** — Fluxos clássicos com "Filtrar Leads" continuam com o mesmo resultado de antes (mesma avaliação, agora compartilhada).
- [ ] **CA-8** — Fluxo em Modo Agente com "Temperatura → Quente", "Responsável" e "Ganho/Perda" aplica no lead o mesmo que o modo normal (antes: "Sem executor registrado").
- [ ] **CA-9** — "Requisição HTTP" no Modo Agente deixa a resposta em `{{vars.httpResponse...}}` para os passos seguintes.
- [ ] **CA-10** — "Enviar Mensagem" com `{{nome}}` e `{{status}}` no Modo Agente sai com nome e coluna do lead (antes saía em branco).
- [ ] **CA-11** — "Enviar Mensagem" do tipo Imagem ou Documento no Modo Agente envia o arquivo (antes falhava com `empty_message`).
- [ ] **CA-12** — "Enviar Contrato" sem modelo escolhido para com "Escolha o modelo de contrato no passo", nos dois modos.
- [ ] **CA-13** — "Mover Lead" seguido de "Enviar Mensagem" com `{{status}}` mostra a coluna nova.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Gatilho sem mensagem (formulário, manual, pagamento) com "Resposta do lead" | Condição não é satisfeita (mesma regra D-3 da spec 0008). |
| CB-2 | Mensagem do gatilho não encontrada na conversa (id de outro formato) | Conta como "escreveu desde o início": o lembrete **não** sai. Erra para o lado de não incomodar. |
| CB-3 | Cliente reage com emoji | Reação não é gravada como mensagem: não conta como resposta. |
| CB-4 | Mensagem gravada sem texto nem mídia (não dispara "Mensagem Recebida") | A sequência para e só recomeça na próxima mensagem com texto ou mídia. |
| CB-5 | Lead apagado durante a espera | Filtro encerra o caminho (`lead não encontrado`). |
| CB-6 | Fluxo existente em Modo Agente com "Esperar 1 dia" feito no editor | Passa a esperar de verdade (antes seguia na hora). É a correção pretendida — ver riscos. |

## 9. Riscos e rollback

- **Mudança de comportamento (CB-6)**: fluxos em Modo Agente que hoje "atravessam" o Esperar em
  horas/dias passam a esperar. Quem montou contava com a espera; ainda assim, vale avisar no
  changelog do produto.
- **Regras da Meta** (conferidas em 16/10/2026): dentro de 24 h da última mensagem do cliente a
  mensagem livre é permitida; fora dela só modelo aprovado — os lembretes de 28 h em diante usam
  modelos de **Marketing**, com tom de serviço. Rotular promoção como Utilidade faz a Meta
  reclassificar o modelo e pode restringir a criação de modelos da conta. Muitos lembretes sem
  resposta aumentam bloqueios e denúncias, o que derruba a qualidade do número: a sequência para
  na primeira resposta, em "SAIR" e na compra.
- **Segurança de dados**: o filtro só lê lead e mensagens do próprio lead, no fluxo da empresa
  dona do funil. Nada novo sai para o cliente além do texto que a empresa escreveu.
- **Cobrança**: botões no Modo Agente passam a cobrar Stars por envio, como o modo normal sempre cobrou.
- **IA pausada**: no Modo Agente, "Enviar Mensagem" passa a enviar para lead com a IA pausada (atendimento humano), como o modo normal. Os passos de app (Proposta, Contrato, Formulário…) seguem exigindo a IA ativa, nos dois modos.
- **Rollback**: reverter o PR. Sem migration.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-16 | Weydson (com Claude) | Criada |
| 2026-10-17 | Weydson (com Claude) | RF-6: paridade de todos os passos do modo normal no Modo Agente; simulador não acusa "desconectado" na API oficial |
| 2026-10-17 | Weydson (com Claude) | RF-7: diferenças dos passos que existem nos dois motores (auditoria) |
| 2026-10-17 | Weydson (com Claude) | Número da API oficial com token e número salvos grava status CONNECTED (formulário e Embedded Signup); simulador diz "O WhatsApp do tracking X está desconectado." Registros antigos se corrigem ao salvar as credenciais de novo |
