---
id: 0072
titulo: ASTRO no WhatsApp respeita o pedido inteiro e a pergunta em aberto
dominio: astro-bot
status: implementada
autor: Weydson
criada: 2026-10-06
atualizada: 2026-10-06
branch: feature/W-astro-whatsapp-intencao-e-contexto-20261006
pr:
peso: leve
---

# 0072 — ASTRO no WhatsApp respeita o pedido inteiro e a pergunta em aberto

## 1. Contexto

Conversa real de 06/10/2026 com o ASTRO pelo WhatsApp, seis erros em sequência:

| # | O usuário disse | O ASTRO fez | Causa |
|---|---|---|---|
| 1 | `Criar uma demanda com o título "Cobrar STARs no Planner, criação, publicação e programação" para hoje às 18h, com os participantes Suellen e João` | Criou `com o título "Cobrar STARs no Planner`, sem hora e sem participantes | `inferTaskFields` cortava o título na primeira vírgula, lia só o dia e o verbo não tinha participantes |
| 2 | `Quantos leads entraram no atendimento órbita?` | "30 leads no funil" + "e mais 20" | A contagem era o tamanho da lista (teto de 30), e "entraram" sem período devolvia o funil inteiro sem avisar |
| 3 | `Preciso adicionar um item no checklist de um workspace` | Criou a demanda "Item no checklist" | Não existe verbo de checklist; o classificador escolheu o vizinho `action.create` |
| 4 | `Quero editar essa última demanda que criei` → `Editar tarefa` | Abriu criação de demanda; depois procurou um workspace chamado "Editar tarefa" | Não existe verbo de editar demanda; resposta fora da lista era tratada como nome |
| 5 | `200,00 em despesa de combustível` | Respondeu o total gasto com combustível | A frase casava com a consulta "gasto por categoria" e nenhum padrão do verbo de lançar |
| 6 | `Sim` (para "Já foi pago?") | "Este post não está em aprovação" | O "sim" era testado contra a proposta pendente mais recente (um aviso de aprovação do Planner, que vive 24h) antes da pergunta em aberto |

## 2. Objetivo

O pedido é lido inteiro, a resposta pertence à pergunta que está no ar, e editar demanda e adicionar item de checklist passam a ter verbo próprio — em vez de virarem criação de demanda.

### Não-objetivos

- Editar descrição, participantes, coluna ou etiquetas da demanda (o verbo cobre título, prazo, responsável e prioridade).
- Marcar item de checklist como feito, renomear ou apagar item, e grupos de checklist.
- Avisar a tela aberta em tempo real: a mudança aparece ao recarregar a demanda.
- Persistir o ciclo guiado em banco (segue em memória, validade de 15 min — limitação já registrada em `guided-slots.ts`).
- Memória de correções do usuário ("aprender com o erro").

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | Título entre aspas vale inteiro, com vírgulas. Sem aspas, "com o título/nome", "chamada" não entram no título. |
| RF-2 | "para hoje às 18h" grava o prazo com a hora; o resumo mostra a hora quando ela foi dita. |
| RF-3 | "com os participantes A e B" grava os participantes que existem na equipe; nome não encontrado aparece no resumo, e a demanda é criada mesmo assim. |
| RF-4 | Pedido de checklist/subtarefa ou de editar demanda nunca cai em `action.create`: o padrão de criar exclui frases de checklist, e os dois verbos novos (RF-9, RF-10) têm padrão próprio. Vale para o chat também. |
| RF-5 | Com lista de opções no ar, resposta que não cita nenhuma opção e abre com verbo de ação é assunto novo, não valor do campo. |
| RF-6 | Frase que abre com valor seguido de despesa/receita/gasto/custo é lançamento: a camada de consulta não responde, e tipo, valor e descrição saem da frase. |
| RF-7 | "Sim"/"não" só decidem proposta pendente quando não há pergunta do ciclo guiado em aberto (mesma regra do chat em `api/astro/chat/route.ts`). |
| RF-8 | A consulta de leads com filtro informa o total real (não o tamanho da lista) e, com "entraram" sem período, avisa que é o total do funil. |
| RF-9 | Verbo `action.update`: edita título, prazo, responsável ou prioridade de uma demanda. Roteiro: qual demanda → o que mudar → dado novo; o que vier na frase pula a pergunta. Exige permissão de editar no Workspace. Trocar o responsável substitui os atuais. |
| RF-10 | Verbo `action.add_checklist_item`: cria um item de checklist (subtarefa) no fim da lista da demanda. Roteiro: item → qual demanda. Exige permissão de editar no Workspace. |
| RF-11 | "Qual demanda" se resolve igual nos dois verbos: id do seletor, "a última que criei" (mais recente criada pelo usuário), ou título parcial. Sem nome, oferece as 8 mais recentes que o usuário criou ou pelas quais responde. Só demandas da organização, não arquivadas. |

## 4. Critérios de aceite

Conferidos por `scripts/verify-astro-whatsapp-intent.ts` (CA-1 a CA-7, sem banco e sem modelo).

- [x] **CA-1** — A frase 1 produz o título completo; "cria a tarefa revisar contrato no workspace Operação para amanhã, urgente" continua igual.
- [x] **CA-2** — "para hoje às 18h" vira prazo às 18:00 de Brasília.
- [x] **CA-3** — "com os participantes Suellen e João" vira o campo de participantes.
- [x] **CA-4** — "Preciso adicionar um item no checklist de um workspace" cai em `action.add_checklist_item` sem inventar item nem demanda; com item entre aspas e "da demanda X", os dois saem da frase.
- [x] **CA-5** — "Quero editar essa última demanda que criei" cai em `action.update` apontando para a última; "muda o prazo da demanda Criar site para sexta às 10h" traz demanda e prazo; "Criar uma demanda…" segue em `action.create` e "muda o telefone do João" segue em `lead.update`.
- [x] **CA-6** — "Editar tarefa" diante da lista de workspaces encerra o ciclo; "3" e "manda no Nubank" continuam.
- [x] **CA-7** — "200,00 em despesa de combustível" cai em `payment.create_entry` com tipo, valor 200 e descrição "combustível"; "quanto gastei com combustível esse mês?" segue consulta.
- [ ] **CA-8** — Com um aviso de aprovação do Planner pendente, responder "Sim" a "Já foi pago?" segue o lançamento e não toca no post. _Passo manual pelo WhatsApp._
- [ ] **CA-9** — Num funil com mais de 30 leads, a consulta informa o total real e o "e mais N" bate com ele. _Passo manual._
- [ ] **CA-10** — Pelo WhatsApp, "editar a última demanda que criei" → "Prazo" → "amanhã" muda o prazo da demanda certa e de nenhuma outra. _Passo manual._
- [ ] **CA-11** — Pelo WhatsApp, "adicionar item no checklist" → item → demanda escolhida na lista cria o item no fim do checklist dela. _Passo manual._

## 5. Casos de borda

| # | Caso | Comportamento esperado |
|---|---|---|
| CB-1 | Participante que não é da equipe | Demanda criada; resumo diz "Não achei X na equipe". |
| CB-2 | Prazo escolhido no seletor do chat (data ISO) | Resumo sem hora, como antes. |
| CB-3 | Workspace cujo nome começa com verbo ("Criar conteúdo") escolhido na lista | Citar a opção vence a regra do verbo: é resposta. |
| CB-4 | "Sim" sem pergunta em aberto e com proposta pendente | Confirma a proposta, como antes. |
| CB-5 | "200 de despesa" sem descrição | Tipo e valor preenchidos; o roteiro pergunta a descrição. |
| CB-6 | Duas demandas com o mesmo título | Vale a mais recente; título idêntico ao pedido vence os parecidos. |
| CB-7 | "A última que criei" e o usuário nunca criou demanda | Oferece as demandas pelas quais ele responde; sem nenhuma, diz que não achou. |
| CB-8 | Dado novo inválido no roteiro (data que não é data, pessoa fora da equipe) | Pergunta de novo o mesmo campo; nada é gravado. |
| CB-9 | Membro sem permissão de editar no Workspace | Recusa antes de perguntar qualquer coisa. |

## 9. Changelog

- 2026-10-06 — Criada e implementada na mesma sessão, a partir da conversa real.
- 2026-10-06 — Editar demanda e item de checklist saíram dos não-objetivos e viraram verbos (RF-9 a RF-11); a barreira "ainda não faço isso" foi removida.
