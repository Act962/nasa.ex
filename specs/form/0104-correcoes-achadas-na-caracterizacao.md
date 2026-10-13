---
id: 0104
titulo: Correções achadas na caracterização do formulário
dominio: form
status: em-revisao
autor: João Gabriel
criada: 2026-10-13
atualizada: 2026-10-13
branch: claude/architecture-audit-modernization-0f66d6
pr: https://github.com/Act962/nasa.ex/pull/459
peso: leve
---

# 0104 — Correções achadas na caracterização do formulário

## 1. Contexto

Os testes de caracterização das etapas 1, 4 e 6 do plano de migração
([`docs/architecture/testing-strategy.md`](../../docs/architecture/testing-strategy.md) §6 e §7)
registraram comportamentos que eram defeito, não regra. Esta spec corrige os que têm resposta certa
sem depender de decisão de produto, antes da extração do módulo `form` (etapa 7), para que a
refatoração não carregue defeito conhecido.

| Defeito | Efeito para o usuário |
| --- | --- |
| `form/delete` apagava formulário de qualquer empresa (S5 da auditoria de segurança) | Usuário logado em uma empresa apagava formulário de outra sabendo o id |
| `form/delete` devolvia 500 para formulário inexistente | Mensagem de erro genérica no lugar de "não encontrado" |
| Cada envio gravava dois registros `form_submit` na jornada do lead; cada mudança de coluna, dois `status_changed` | Linha do tempo do lead mostrava "Preencheu: X" duas vezes e a mudança de etapa duas vezes |
| A pontuação do marco de 10 e 100 respostas rodava dentro da transação do envio, com o cliente global | Violação da regra 18; pontuação gravada mesmo se o envio fosse desfeito |
| Nome de formulário cortado em 80 caracteres num separador gerava `--` no endereço | Cosmético |
| Parágrafo com `text` vazio era dado como sem conteúdo mesmo com `content` preenchido | Formulário podia aparecer como não pronto sem motivo |
| Resposta com o JSON `null` derrubava o envio com erro interno | 500 em entrada malformada, que a rota já tolera nos outros casos |

## 2. Objetivo

Corrigir os sete defeitos acima sem mudar nenhuma outra regra do envio de formulário.

### Não-objetivos

- Isolamento por empresa das demais procedures de `form` (`publish`, `update` e outras): etapa 8 do
  plano de migração, em lotes.
- Apagar os registros duplicados que já existem na jornada dos leads.
- Comportamentos que são decisão de produto e seguem como estão: lead novo a cada envio sem telefone,
  nome do formulário ignorado para lead existente, lead criado no primeiro "Próximo".
- Comportamentos conferidos e mantidos por serem intencionais: lead novo volta sem link público (o
  link é gerado sob demanda por `leads.generatePublicLink`); resposta que não é JSON é aceita
  (comentado como intencional em `save-partial-response.ts`); as regras de pontos vêm de
  `prisma/seed-a.ts`, não do código em tempo de execução.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | `form/delete` só apaga formulário da empresa ativa da sessão |
| RF-2 | Formulário de outra empresa ou inexistente responde `NOT_FOUND`, sem diferenciar os dois casos |
| RF-3 | Um envio grava um registro `form_submit` na jornada, com o id da resposta, o título e o indicador de reenvio (`returning`) ou de rascunho finalizado (`finalized`) |
| RF-4 | Uma mudança de coluna causada pelo envio grava um registro `status_changed`, com coluna anterior, coluna nova e `source: "form_submit"` |
| RF-5 | A pontuação do marco roda depois do commit; falha nela não invalida o envio |
| RF-6 | O endereço da resposta não termina o nome em hífen |
| RF-7 | Parágrafo tem conteúdo se `text` ou `content` tiver texto |
| RF-8 | Resposta `null` é tratada como resposta vazia |

## 4. Critérios de aceite

| ID | Critério | Teste |
| --- | --- | --- |
| CA-1 | Usuário de outra empresa recebe `NOT_FOUND` e o formulário continua no banco | `tests/integration/tenancy/cross-organization.test.ts` |
| CA-2 | Usuário da própria empresa apaga o formulário | idem |
| CA-3 | Id inexistente devolve `NOT_FOUND` | idem |
| CA-4 | Envio de lead novo, de lead existente e de rascunho deixa exatamente um `form_submit` na jornada, com `returning` ou `finalized` | `tests/integration/form/submit-response.characterization.test.ts` |
| CA-5 | Envio que move o lead de coluna deixa exatamente um `status_changed` | idem |
| CA-6 | Nome de 79 letras seguido de espaço gera um hífen só antes da data | `src/features/form/lib/response-slug.test.ts` |
| CA-7 | Parágrafo com `text: ""` e `content` preenchido não é problema; com os dois vazios, é | `src/features/form/lib/form-readiness.test.ts` |
| CA-8 | A 10ª resposta pontua o dono do formulário e o envio conclui | `tests/integration/form/submit-response-actions.characterization.test.ts` |
| CA-9 | Resposta `null` conclui o envio | `tests/integration/form/submit-response.characterization.test.ts` |

## 5. Efeito sobre dados e telas existentes

- **Jornada do lead.** Quem lê os registros usa `formId`, `label`, `returning`, `newStatusId` e
  `previousStatusId` (`leads/journey/get.ts`, `public-timeline.ts`, `extract-deadline.ts`,
  `event-details.tsx`). O registro único carrega todos. O texto "Reenviou: X" passa a vir junto do
  título da resposta, que antes só aparecia na linha "Preencheu".
- **Registros antigos** continuam duplicados na linha do tempo. Não há migração.
- **Prazo por gatilho** (`isDeadlineFulfilled`): bastava um registro para cumprir; continua igual.
- **`form/delete`**: a tela só lista formulários da empresa ativa, então o uso normal não muda.

## 6. Rollback

Reverter o commit. Nenhuma mudança de schema.

## 7. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-13 | Criada e implementada |
