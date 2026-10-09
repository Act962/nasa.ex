---
id: 0078
titulo: Astro responde as tarefas do dia e conclui tarefas, uma ou várias
dominio: astro
status: implementada
autor: Weydson
criada: 2026-10-09
atualizada: 2026-10-09
branch: feature/W-astro-correcoes-e-novas-funcionalidades-20261009
pr:
peso: leve
---

# 0078 — Astro responde as tarefas do dia e conclui tarefas, uma ou várias

## 1. Contexto

Conversa real no WhatsApp em 09/10/2026:

- "Quantas tarefas tenho hoje?" → "1 tarefa em aberto criada hoje". O Astro contou as tarefas **criadas** hoje, da empresa inteira. Quem pergunta quer as **suas**, com **prazo** hoje.
- "Me traga as que tem alta prioridade e finalize as do mês passado que não foram concluídas." → "O que você quer mudar em QUARTA 20/05?". O Astro não filtra por prioridade, não entende a pergunta de continuação sem a palavra "tarefas" e **não sabe concluir tarefa**: o pedido caiu em "editar demanda", numa tarefa qualquer.

## 2. Objetivo

O Astro responde quantas e quais tarefas a pessoa tem para um dia, filtra por prioridade, e conclui tarefas (uma pelo nome ou várias por filtro), sempre com confirmação antes.

### Não-objetivos

- Reabrir tarefa concluída pelo Astro.
- Concluir tarefas de outras pessoas em lote (decisão do Weydson em 09/10: só as de quem pediu).
- Atender consulta e conclusão **na mesma frase**. Em "traga as de alta prioridade e finalize as do mês passado", o Astro trata a conclusão; a lista é pedida em seguida.
- Sub-ações e checklist.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Na consulta de tarefas, um período na frase ("hoje", "amanhã", "sexta", "nesta semana", "mês passado") filtra pelo **prazo** (`dueDate`). Só filtra pela criação quando a frase diz "criadas". |
| RF-2 | "Hoje" conta as tarefas em aberto com prazo hoje **mais as atrasadas**, e a resposta separa os dois números. |
| RF-3 | "Tenho", "minhas", "meus", "estou" restringem às tarefas em que quem pergunta é responsável, na contagem e na lista. |
| RF-4 | "Alta prioridade", "urgentes", "prioridade média/baixa" filtram por `priority`. "Alta" inclui urgente. |
| RF-5 | Pergunta de continuação sem a palavra "tarefas" ("me traga as que têm alta prioridade", "quais estão atrasadas") é respondida quando o turno anterior falava de tarefas. |
| RF-6 | Nova ação `action.complete`: "conclui a tarefa X", "finaliza a demanda X", "marca X como concluída". Uma tarefa pelo nome, qualquer uma da empresa que a pessoa possa editar. |
| RF-7 | A mesma ação em lote, quando a frase traz filtro em vez de nome: período pelo prazo ("do mês passado"), "atrasadas", prioridade. Só entram tarefas em aberto, não arquivadas, em que **quem pediu é responsável**. |
| RF-8 | Toda conclusão passa por confirmação. O cartão mostra quantas tarefas serão concluídas e os títulos (até 10, depois "e mais N"). Nada muda antes do "confirmar". |
| RF-9 | Lote limitado a 50 tarefas por pedido. Acima disso o Astro conclui as 50 de prazo mais antigo e avisa quantas ficaram. |
| RF-10 | Concluir pelo Astro tem os mesmos efeitos de concluir na tela: `isDone`, `closedAt`, pontos, automação "ação concluída" do workspace e registro de atividade. Os efeitos rodam fora de transação (Regra 18) e **depois da resposta**, um por vez: falha em efeito não desfaz a conclusão. |
| RF-11 | Em pedido com consulta e conclusão na mesma frase, o filtro da conclusão é lido só do trecho a partir do verbo de concluir. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado que tenho 2 tarefas com prazo hoje e 3 atrasadas, e a empresa tem outras de colegas, quando pergunto "quantas tarefas tenho hoje?", então a resposta diz 2 para hoje e 3 atrasadas.
- [ ] **CA-2** — "Quantas tarefas pendentes criadas hoje?" continua contando pela data de criação.
- [ ] **CA-3** — Depois de "quantas estão atrasadas?", a frase "me traga as que têm alta prioridade" devolve a lista só com tarefas de prioridade alta ou urgente.
- [ ] **CA-4** — "Finalize as do mês passado que não foram concluídas" abre um cartão de confirmação com a quantidade e os títulos das minhas tarefas em aberto com prazo no mês passado; nenhuma tarefa muda até eu confirmar.
- [ ] **CA-5** — Ao confirmar, as tarefas ficam concluídas com `closedAt` preenchido, e tarefas de colegas com prazo no mesmo mês continuam em aberto.
- [ ] **CA-6** — "Conclui a tarefa Revisar contrato" pede confirmação e conclui só essa tarefa.
- [ ] **CA-7** — Sem nenhuma tarefa no filtro, o Astro responde que não achou nada para concluir, sem cartão de confirmação.
- [ ] **CA-8** — "Finalize as do mês passado" não abre mais o roteiro de editar demanda.

## 5. Abordagem

- Consulta `workspace.actions_pending` em `src/features/astro/queries/apps.ts`: filtros de prazo, dono e prioridade extraídos da frase; `matches` passa a olhar o histórico para a continuação.
- Efeitos de concluir saem de `src/features/actions/server/routes/toggle-done.ts` para um helper em `src/features/actions/server/lib/`, usado pela rota e pelo Astro.
- Nova ação em `src/features/astro/actions/workspace/complete-action.ts`, com `requiresConfirmation: true`, registrada no `registry.ts`. O padrão de intenção dela vem antes do de editar.

## 9. Changelog

- 2026-10-09 — criada.
- 2026-10-09 — aprovada pelo Weydson e implementada. Divergências da primeira versão: os efeitos de concluir passaram a rodar depois da resposta (RF-10), porque 50 tarefas em sequência levariam minutos; e RF-11, porque "traga as de alta prioridade e finalize as do mês passado" aplicava "alta prioridade" à conclusão.
- 2026-10-09 — conferido à mão no Astro da `/home` local: CA-1 (parcial, 1 tarefa), CA-3, CA-4 a CA-8. CA-2 e o limite de 50 (RF-9) não foram exercitados. Não há runner de testes no projeto (Regra 20).
