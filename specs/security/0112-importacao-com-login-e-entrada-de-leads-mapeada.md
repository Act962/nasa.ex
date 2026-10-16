---
id: 0112
titulo: Importação do N.A.S.A antigo exige login; entrada externa de leads validada e mapeada
dominio: security
status: em-revisao
autor: João Gabriel
criada: 2026-10-16
atualizada: 2026-10-16
branch: claude/architecture-audit-modernization-0f66d6
pr: https://github.com/Act962/nasa.ex/pull/459
peso: leve
---

# 0112 — Importação com login e entrada de leads mapeada

## 1. Contexto

S6 e S7 da auditoria de segurança ([`docs/seguranca-auditoria-2026-08.md`](../../docs/seguranca-auditoria-2026-08.md)).

**S6.** `integrations.newNasa` e `integrations.newNasaPartial` importam empresa, trackings, colunas e
tags do N.A.S.A antigo (Bubble) a partir de um e-mail. Estavam marcadas como integração de terceiros,
mas o único chamador é a tela **Configurações → Integração**, com o usuário logado, que já envia o
e-mail da própria sessão. Sem login, qualquer pessoa disparava a importação para qualquer e-mail,
sobrescrevendo dados e tornando o dono desse e-mail OWNER da empresa importada.

**S7.** `POST /api/external/new-lead` recebe leads de sites e landing pages com `trackingId` e
`statusId` no corpo, sem credencial nem validação. Quem conhece o id de um tracking injeta leads no
funil de qualquer empresa. A correção segura (chave por empresa) quebraria todo site que envia lead
hoje, e não sabemos quantos são.

## 2. Objetivo

Fechar S6 por completo. Em S7, barrar o envio inválido e descobrir quem usa a porta, sem parar
nenhum site, para decidir a chave por empresa com a lista em mãos.

### Não-objetivos

- Chave por empresa em S7: decisão posterior, com base no mapeamento.
- Limite de chamadas por IP: exige armazenamento compartilhado entre instâncias; fica para a mesma
  decisão.
- Restringir a importação por papel (Master, Adm, Moderador): hoje só a tela restringe. Registrado
  como pendência.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | `newNasa` e `newNasaPartial` exigem sessão e usam o e-mail do usuário logado. A entrada não recebe mais e-mail |
| RF-2 | `external/new-lead` valida o corpo: `trackingId`, `statusId` e `name` obrigatórios, textos com tamanho máximo. Inválido responde 400 sem gravar |
| RF-3 | `external/new-lead` só grava quando a coluna (`statusId`) pertence ao tracking. Caso contrário responde 400 sem gravar. Hoje esse caso grava um lead incoerente |
| RF-4 | Cada lead recebido registra quem chamou no registro de atividade `lead.arrived`: `metadata.callerOrigin` (cabeçalho `Origin`, ou a origem do `Referer`) e `metadata.callerUserAgent` (até 200 caracteres), que identifica chamadas de servidor, como Zapier, que não mandam `Origin` |
| RF-5 | Envio válido segue com a mesma resposta de antes (`{ success: true }`) |

## 4. Critérios de aceite

| ID | Critério | Teste |
| --- | --- | --- |
| CA-1 | Sem sessão, `newNasa` e `newNasaPartial` respondem `UNAUTHORIZED` e não chamam o N.A.S.A antigo | `tests/integration/security/external-entry-points.test.ts` |
| CA-2 | Com sessão, a importação consulta o N.A.S.A antigo com o e-mail da sessão | idem |
| CA-3 | Corpo inválido responde 400 e não cria lead | idem |
| CA-4 | Coluna de outro tracking responde 400 e não cria lead | idem |
| CA-5 | Envio válido cria o lead, responde `{ success: true }` e registra a origem em `lead.arrived` | idem |

## 5. Implantação

Sem configuração. Depois de alguns dias em produção, a lista de quem usa a porta sai do banco:

```sql
SELECT metadata->>'callerOrigin' AS origem, count(*) AS leads, max(created_at) AS ultimo
FROM system_activity_log
WHERE action = 'lead.arrived' AND metadata->>'source' = 'FORM'
GROUP BY 1 ORDER BY 2 DESC;
```

**Risco:** site que hoje manda coluna errada ou sem nome passa a receber 400. Antes, esse envio
gravava lead incoerente ou caía no erro genérico (`{ success: false }`).

## 6. Rollback

Reverter o commit.

## 7. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-16 | Criada e implementada |
