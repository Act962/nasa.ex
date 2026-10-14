---
id: 0106
titulo: Trava de isolamento entre empresas, lote 1
dominio: security
status: em-revisao
autor: João Gabriel
criada: 2026-10-14
atualizada: 2026-10-14
branch: claude/architecture-audit-modernization-0f66d6
pr: https://github.com/Act962/nasa.ex/pull/459
peso: leve
---

# 0106 — Trava de isolamento entre empresas, lote 1

## 1. Contexto

S5 da auditoria de segurança ([`docs/seguranca-auditoria-2026-08.md`](../../docs/seguranca-auditoria-2026-08.md)):
procedures autenticadas recebem o id de um recurso e o usam sem conferir se ele pertence a uma
empresa do usuário. Quem está logado em qualquer empresa e conhece o id lê ou altera dado de outra.

A auditoria confirmou seis casos por leitura. `form/delete` foi corrigido na spec 0104. Esta spec
cobre os outros cinco e um sétimo achado durante a migração do formulário (etapa 7): o formulário
público aplica ao lead tags de qualquer empresa, porque o id da tag vem da resposta.

| Procedure | Efeito sem a trava |
| --- | --- |
| `status/create` | Cria coluna no tracking de outra empresa |
| `leads/deleteFile` | Apaga arquivo de lead de outra empresa |
| `conversation/get` | Lê conversa e dados do lead (PII) de outra empresa |
| `status/listSimple` | Lê as colunas de um tracking de outra empresa |
| `column/getMany` | Lê as colunas de um workspace de outra empresa |
| Envio do formulário público | Anexa ao lead tag de outra empresa, pela resposta ou pelo botão "Próximo" |

## 2. Objetivo

Recurso pedido por id só é alcançado por quem tem vínculo com a empresa dona dele, sem bloquear quem
tem vínculo legítimo.

### Não-objetivos

- As outras 173 procedures candidatas: lotes seguintes da etapa 8, ordenados por
  [`docs/architecture/tenancy-triage.md`](../../docs/architecture/tenancy-triage.md).
- Regra de setor (participar do tracking para ver o lead): já existe onde existe e não muda.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Alcança o recurso quem é membro da empresa dona, participante do tracking dele ou membro do workspace dele |
| RF-2 | A empresa ativa da sessão não entra na regra: quem é membro de várias empresas usa recursos de todas |
| RF-3 | Recurso de outra empresa responde `NOT_FOUND`, como recurso inexistente, para não revelar que o id existe |
| RF-4 | Recurso inexistente segue para a procedure, que responde como já respondia |
| RF-5 | Cada lote começa **só registrando** o que seria negado (`[tenancy-guard] seria negado ...` no log) e passa a negar quando o nome do lote entra em `TENANCY_GUARD_ENFORCED_BATCHES` |
| RF-6 | O formulário público só aplica tags da empresa dona do formulário. Vale já, sem fase de registro: tag de outra empresa nunca é uso legítimo |
| RF-7 | O CI falha se surgir procedure autenticada nova sem conferência de empresa (catraca S5 no job `arch`) |

## 4. Critérios de aceite

| ID | Critério | Teste |
| --- | --- | --- |
| CA-1 | Com o lote aplicado, outra empresa recebe `NOT_FOUND` nas cinco procedures, e criação e exclusão não acontecem | `tests/integration/tenancy/tenancy-guard-batch-1.test.ts` |
| CA-2 | A própria empresa segue usando as cinco | idem |
| CA-3 | Membro das duas empresas usa o recurso de A com B ativa | idem |
| CA-4 | Participante do tracking e membro do workspace de fora da empresa seguem usando | idem |
| CA-5 | Id inexistente recebe a resposta de antes | idem |
| CA-6 | Sem o lote aplicado, outra empresa é atendida e o log registra o que seria negado | idem |
| CA-7 | Tags de outra empresa, na resposta ou no "Próximo", não são aplicadas, nos dois caminhos do envio | `tests/integration/form/submit-response.characterization.test.ts` |
| CA-8 | Procedure nova sem conferência é regressão no `pnpm arch` | `scripts/arch/feature-boundaries.test.ts` |

## 5. Implantação

1. Publicar sem `TENANCY_GUARD_ENFORCED_BATCHES`. O lote só registra.
2. Acompanhar `[tenancy-guard] seria negado batch=lote-1` no log por alguns dias. Cada linha diz a
   procedure, o recurso e o usuário. Linha de uso legítimo indica vínculo que a regra não conhece:
   parar e revisar a regra antes de aplicar.
3. Sem linha legítima, definir `TENANCY_GUARD_ENFORCED_BATCHES=lote-1`. Não exige novo build.

**Recomendação:** as cinco procedures têm caso confirmado de abuso e a regra aceita todo vínculo
conhecido. Encurtar o passo 2 para um ou dois dias é razoável.

## 6. Rollback

Remover `lote-1` de `TENANCY_GUARD_ENFORCED_BATCHES` volta o lote a só registrar. A regra das tags
volta revertendo o commit.

## 7. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-14 | Criada e implementada |
