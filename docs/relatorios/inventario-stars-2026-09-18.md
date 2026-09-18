# Inventário do motor de Stars — 2026-09-18

> Relatório da **Fase 0** do plano em [`docs/BILLING_ARCHITECTURE.md`](../BILLING_ARCHITECTURE.md).
> Todos os números vieram de query direta no banco de desenvolvimento (`nasa_db`, container
> `nasa-db`), sem escrita. Este arquivo é versionado de propósito: é a fotografia do estado
> anterior às correções, e é a prova a consultar se alguém questionar saldo depois.

**Data da coleta:** 2026-09-18
**Branch:** `claude/orbita-commercial-architecture-cf2e3f`
**Commit base:** `4b575e24`

---

## 1. Escala atual

| Métrica | Valor |
| --- | ---: |
| Organizações | 101 |
| Organizações com plano | 24 |
| Assinaturas ativas (`status` active/trialing) | 2 |
| Planos cadastrados | 4 |
| Transações de Stars | 37.783 |
| Registros de uso de IA (`ai_chat_run`) | 2.515 |

**Leitura:** a base é pequena e o risco de todas as correções é baixo. Isso é uma janela — as
mesmas correções feitas com 1.000 orgs pagantes seriam muito mais caras.

---

## 2. O ciclo mensal nunca rodou duas vezes — confirmado

Distribuição de créditos de plano por organização:

| Ciclos creditados | Organizações |
| ---: | ---: |
| 1 | 12 |

**Nenhuma organização recebeu um segundo crédito.** Não existe org com 2, 3 ou mais.

Tempo desde o início do ciclo, por plano:

| Plano (slug real no banco) | Orgs | Dias desde o início do ciclo | Saldo somado |
| --- | ---: | ---: | ---: |
| `constellation-mnj648ae` | 8 | 0 | 52.672 |
| `earth-mo1vk0jx` | 4 | **94** | 6.232 |
| `explore-mo1vq0oi` | 3 | 6 | 8.189 |
| `suit-mnj5mcxr` | 9 | 0 | 2.700 |

Uma organização do Earth está há **94 dias** (mais de três meses) no mesmo ciclo, com um único
crédito. Ela pagou três mensalidades e recebeu a franquia de uma.

### Achado lateral: os slugs de plano no banco não são os do seed

O seed (`prisma/seed-plans.ts`) define `suite`, `earth`, `explore`, `constellation`. O banco tem
`suit-mnj5mcxr`, `earth-mo1vk0jx`, `explore-mo1vq0oi`, `constellation-mnj648ae` — com sufixo, e
`suit` sem o "e".

Isso importa porque a propagação de plano casa o plano da assinatura contra `Plan.slug` **ou**
`Plan.name`. Com slug sufixado, o casamento depende inteiramente do `name`. Precisa ser verificado
antes de mexer no ciclo.

---

## 3. Catálogo de preço: 14 ações cobram no código e não têm preço

| Métrica | Valor |
| --- | ---: |
| Linhas em `app_star_costs` | 66 |
| Delas, com `category = 'action'` | 56 |
| Delas, com custo ≤ 0 (desligadas) | 8 |
| Chaves de ação referenciadas no código | 38 |

### 3.1 Ações cobradas no código, **sem linha no banco** → grátis hoje, em silêncio

```
astro_prompt                    ← a cobrança por prompt do ASTRO
astro_finance_document
astro_finance_reminder_send
astro_finance_statement_pdf
calendar_share_enable
check_payment_query
form_publish
linnker_page_create
linnker_scan_capture
nasa_planner_post_create
page_publish
send_email_transactional
tracking_preset_apply
workspace_action_create
```

**`astro_prompt` é o caso grave.** É a cobrança-base de cada prompt do ASTRO, e ela vem sendo
pulada desde sempre. O que ainda cobra no ASTRO é só o excedente por token, que roda por outro
caminho e não passa pelo catálogo.

As quatro chaves `astro_finance_*` confirmam a pendência que o `docs/ASTRO_PROGRESS.md` já
registrava como "falta cadastrar" — está faltando mesmo.

> Esta é exatamente a razão de a Fase 1 parar de tratar "linha ausente" como "grátis e silencioso".
> Hoje não existe nenhum sinal quando isso acontece.

### 3.2 Linhas cadastradas com custo zero (desligadas de propósito)

| Chave | Categoria |
| --- | --- |
| `plan_renewed` | action |
| `stars_balance_low` | action |
| `stars_balance_zero` | action |
| `tel_link_dial` | action |
| `explorer`, `insights`, `integrations`, `nbox` | (sem categoria — linhas legado de app) |

As três primeiras são eventos de notificação, faz sentido custarem zero. As quatro sem categoria
são resquício do modelo de aluguel por app.

---

## 4. Aluguel por app: risco zero para aposentar

| Métrica | Valor |
| --- | ---: |
| `workspace_integrations` ativas | **0** |

Nenhuma organização tem app "alugado" hoje. A decisão de aposentar o modelo de cobrança mensal por
app **não afeta nenhum cliente**. As 4 linhas legado sem categoria em `app_star_costs` são o único
resíduo.

---

## 5. Refill de moderador: uma organização, 999.902★

| Métrica | Valor |
| --- | ---: |
| Transações de reabastecimento automático | 1 |
| Organizações afetadas | 1 |
| Total creditado | 999.902 ★ |

Disparou uma vez só. O raio de alcance é pequeno, mas o crédito é grande o bastante para distorcer
qualquer média de consumo — por isso `MANUAL_ADJUST` precisa ficar de fora de toda análise de
custo unitário.

Total de `MANUAL_ADJUST` na base: 101 transações (as outras 100 são ajustes administrativos).

---

## 6. Suspensão e grace: fila pequena

| Métrica | Valor |
| --- | ---: |
| Orgs com `stars_suspended_at` preenchido | 1 |
| Orgs com `stars_grace_started_at` preenchido | 1 |

Ligar o bloqueio por suspensão afeta **uma** organização. Risco baixo, mas ainda assim vale checar
se essa org tem saldo antes de bloquear — suspensão marcada durante meses sem enforcement pode
estar obsoleta.

---

## 7. Regras por organização

| Métrica | Valor |
| --- | ---: |
| Linhas em `star_rule` | 3.241 |

São ~32 regras por organização (3.241 ÷ 101), consistente com o seed padrão de 54 regras aplicado
parcialmente. Ainda é preciso apurar **quantas divergem do padrão** antes de promover essa tabela a
camada de override — se alguma foi editada à mão, o preço muda em silêncio.

---

## 8. Consolidado de riscos, com o número medido

| Risco previsto no plano | Tamanho real medido | Veredito |
| --- | --- | --- |
| Aposentar aluguel por app quebra clientes | 0 orgs afetadas | ✅ Seguro |
| Ligar suspensão bloqueia fila represada | 1 org | ✅ Seguro, checar saldo antes |
| Remover refill de moderador muda saldos | 1 org, 1 ocorrência | ✅ Seguro atrás de flag |
| Corrigir ciclo mensal derruba saldo por rollover | 12 orgs com 1 crédito; 1 org há 94 dias | ⚠️ Simular antes, decisão de produto |
| Catálogo de preço vazio | 14 de 38 chaves sem preço, incluindo `astro_prompt` | 🚨 **Pior que o previsto** |
| Alertas de 70%/90% dispararem de uma vez | 24 orgs com plano | ⚠️ Silenciamento único necessário |

**A prioridade mudou.** O plano previa que o catálogo vazio *poderia* ser um problema. Ele é: a
cobrança-base do ASTRO está desligada. Popular o catálogo sobe para o topo da Fase 1.

---

## Como reproduzir

As queries estão no corpo deste relatório e foram executadas via:

```bash
docker exec nasa-db psql -U docker -d nasa_db -t -A -c "<query>"
```

Nenhuma escrita foi feita. O cruzamento entre chaves do código e linhas do banco foi feito
extraindo os literais de `chargeStarsByAction` e as constantes de `AGENT_STARS_ACTIONS`,
`FINANCE_EXTRACTION_STARS_ACTION`, `PDF_STATEMENT_STARS_ACTION` e `REMINDER_STAR_ACTION`.
