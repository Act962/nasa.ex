---
id: 0051
titulo: Aba Contábil — fundação contábil, guias, documentos, créditos e precificação
dominio: accounting
status: em-revisao
autor: Weydson (com Claude)
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-financeiro-aba-contabil-20260929
pr:
peso: completa
---

# 0051 — Aba Contábil (Fase 1)

## 1. Contexto

O NASA Payment cobre contas a pagar e a receber, conciliação e DRE gerencial, mas não tem nenhuma das peças abaixo:

- plano de contas nem partidas dobradas;
- perfil fiscal, alíquotas, apuração e guias;
- calendário de obrigações;
- controle de documentos da empresa;
- créditos de tributo.

Por isso o dono da empresa depende do contador para tudo e não enxerga o custo tributário do que vende.

A Reforma Tributária (EC 132/2023 e LC 214/2025) torna isso urgente:

- 2026 é ano-teste de CBS/IBS.
- Em 2027 a CBS entra cheia.
- O crédito não cumulativo passa a depender de nota de entrada, o que torna a nota do fornecedor um ativo financeiro.

O público inicial são as PMEs do Piauí (Teresina), nos três regimes.

## 2. Objetivo

Com a aba Contábil, a empresa passa a:

- saber quanto e quando pagar de imposto, com memória de cálculo e base legal;
- gerar a guia como conta a pagar;
- manter os documentos em dia com um score de regularidade;
- aproveitar créditos de IBS/CBS;
- precificar considerando a carga tributária.

Tudo isso com o mínimo de dependência de contador e com explicação em cada termo técnico.

### Não-objetivos (Fase 1)

- Emissão de NF-e/NFS-e e captura automática de notas recebidas (DF-e). Ficam para a Fase 2, via API emissora.
- Livro PF / IRPF dos sócios (Fase 3).
- Apuração completa do Lucro Real, LALUR, SPED ECD/ECF/EFD e DCTFWeb gerados pelo sistema (Fase 4). Na Fase 1, o Real tem razão, balancete e PIS/COFINS/ISS.
- Consulta automática de certidões, DAE-PI e split payment (Fase 5).
- Repartição do DAS por tributo (quanto do DAS é IRPJ, CSLL etc.) e segregação de receita entre anexos diferentes na mesma empresa. A Fase 1 usa um anexo por empresa.
- ICMS de mercadoria (depende de NCM, UF e ST). A precificação avisa e não calcula.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | A contabilidade é derivada do `PaymentEntry`. Cada lançamento gera um registro de competência e, se pago, outro de baixa, ambos em partidas dobradas balanceadas. |
| RF-2 | Plano de contas padrão PME criado sob demanda. Categorias e contas bancárias podem ser mapeadas para contas contábeis. |
| RF-3 | Alíquotas ficam em `TaxRate`, versionadas por vigência e provisionadas de forma idempotente por `seedKey`. |
| RF-4 | O perfil fiscal guarda regime, CNAE, anexo, Fator R, UF/município, IE/IM, funcionários, ICMS/ISS, presunções, opção IBS/CBS por fora e telefones de aviso. |
| RF-5 | A apuração mensal grava `TaxAssessment` em DRAFT com a memória de cálculo. Não sobrescreve CONFIRMED/PAID. |
| RF-6 | Confirmar uma apuração com valor > 0 cria `PaymentEntry PAYABLE` na categoria "Impostos e taxas" e vincula a obrigação. |
| RF-7 | O calendário fiscal (`FiscalObligation`) é gerado pelo regime. A obrigação vira DONE com guia paga ou comprovante do período, e OVERDUE depois do vencimento. |
| RF-8 | Catálogo de documentos da empresa em código, com ajuste por org (não se aplica, peso, validade). |
| RF-9 | O score de regularidade é Σ peso dos itens em dia ÷ Σ peso dos itens aplicáveis. "Vencendo" conta como em dia. Um mês de guia ou nota em aberto zera o item mensal. |
| RF-10 | Os documentos ficam na pasta restrita "Documentos da empresa" do N-Box, visível só para ADMIN/OWNER do financeiro. Item restrito nunca vira público. |
| RF-11 | Cofre de credenciais cifrado (AES-256-GCM). Revelar exige WebAuthn e fica em log. O certificado A1 é cifrado e tem a validade lida do próprio arquivo. |
| RF-12 | Notas de entrada (XML primeiro, IA como alternativa) geram `TaxCredit` de CBS/IBS. O crédito fica AVAILABLE quando a despesa é paga e abate a apuração. |
| RF-13 | A alíquota efetiva do perfil alimenta o simulador do Forge (persistida), a proposta (`taxBreakdown`) e o diagnóstico de produtos. |
| RF-14 | A calculadora contábil tem uma definição única (registro), com campos pré-preenchidos pelo perfil e memória de cálculo. Fica disponível na subaba e em botão flutuante. |
| RF-15 | Todo termo técnico da aba tem ⓘ com explicação, exemplo, base legal, links oficiais e "Perguntar ao ASTRO", a partir de um glossário único. |
| RF-16 | Avisos de prazo fiscal, documento vencendo/vencido e queda de score saem no sino/push e no WhatsApp (telefones do perfil), e disparam o gatilho de automação `COMPLIANCE_ITEM_DUE`. |
| RF-17 | O ASTRO ganha 20 ferramentas contábeis de leitura (visão geral, glossário, perfil, simulações DAS/CBS-IBS, calculadora, apurações, obrigações, créditos, ranking de fornecedores, despesas sem nota, score, documentos, balancete/balanço, Reforma, tabelas de alíquotas, diagnóstico de preços, link da subaba). Pergunta fiscal não cai nas consultas do financeiro, e a subaba aberta chega como contexto (widget, Commander e WhatsApp no escopo financeiro). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Dinheiro em centavos (Int) e alíquota em bps. Nenhuma soma em ponto flutuante nos motores. |
| RNF-2 | Os motores fiscais são funções puras, verificáveis sem banco (`scripts/accounting-qa-check.ts`). |
| RNF-3 | Nenhum efeito colateral dentro de `$transaction` (regra 18). O journal é sincronizado via Inngest depois do commit. |
| RNF-4 | Migration só aditiva: nenhuma coluna existente muda de tipo ou é removida. |

## 4. Critérios de aceite

Os números abaixo são os casos de referência de `scripts/accounting-qa-check.ts`.

- [x] **CA-1**: Dada uma despesa de R$ 500 paga, a sincronização gera ACCRUAL (D despesa / C fornecedores) e SETTLEMENT (D fornecedores / C banco), ambos balanceados.
- [x] **CA-2**: Um lançamento CANCELLED ou PENDING_APPROVAL não gera contabilidade.
- [ ] **CA-3**: Um balancete de qualquer período tem Σ débitos = Σ créditos (verificação manual no ambiente).
- [x] **CA-4**: Simples, Anexo III, RBT12 de R$ 300.000 e receita no mês de R$ 30.000 → alíquota efetiva de 8,08% e DAS de R$ 2.424,00.
- [x] **CA-5**: Com serviço sujeito ao Fator R e RBT12 de R$ 600.000:
  - folha de R$ 180.000 (30%) → Anexo III e DAS de R$ 5.280,00 sobre R$ 50.000;
  - folha de R$ 100.000 (16,67%) → Anexo V e R$ 8.925,00.
- [x] **CA-6**: Empresa com 3 meses de atividade → RBT12 = média × 12.
- [x] **CA-7**: DAS-MEI de serviços em 2026 = R$ 86,05 [VERIFICAR salário mínimo 2026].
- [x] **CA-8**: Presumido com receita de R$ 300.000 no trimestre:
  - IRPJ de R$ 14.400;
  - adicional de R$ 3.600;
  - CSLL de R$ 8.640.
- [x] **CA-9**: Presumido com receita de R$ 100.000 no mês → PIS de R$ 650, COFINS de R$ 3.000 e ISS (5%) de R$ 5.000. Em 2027, PIS/COFINS = 0.
- [x] **CA-10**: Em 2026, CBS de 0,9% e IBS de 0,1% são destacados, com R$ 0 a recolher (ano-teste).
- [x] **CA-11**: Em 2027 o crédito de CBS abate o débito, e a redução de 60% do cClassTrib reduz a base a 40%.
- [x] **CA-12**: Markup divisor com custo de R$ 60, impostos de 10%, comissão de 5% e margem de 25% → preço de R$ 100.
- [x] **CA-13**: Alíquota efetiva de precificação (Simples III, RBT12 de R$ 300 mil) = 8,08%.
- [x] **CA-14**: Guia federal com 21 dias de atraso → multa de 6,93% e juros de 1%. A multa tem teto de 20%.
- [x] **CA-15**: Pró-labore de R$ 5.000 → INSS de R$ 550 e IRRF zerado pelo redutor de 2026 [VERIFICAR tabela].
- [x] **CA-16**: Retenções de IRRF (1,5%) e CSRF (4,65%) sobre R$ 10.000 → líquido de R$ 9.385.
- [x] **CA-17**: O XML de NF-e traz a chave de 44 dígitos, IBS de R$ 1,00 e CBS de R$ 9,00 do `IBSCBSTot`, e NCM/cClassTrib por item. XML inválido não lança erro.
- [x] **CA-18**: Todos os documentos aplicáveis válidos e todos os meses cumpridos → score de 100%.
- [x] **CA-19**: Um mês de DAS em aberto derruba o score, e o item fica OVERDUE.
- [x] **CA-20**: CRF do FGTS emitido há mais de 30 dias → EXPIRED.
- [x] **CA-21**: Documento ausente → MISSING. Item marcado "não se aplica" sai do score.
- [x] **CA-22**: O DAS de set/2026 vence em 20/10/2026 (vencimento em fim de semana antecipa).
- [x] **CA-23**: Toda calculadora do registro roda com campos vazios sem lançar erro.
- [x] **CA-24**: Todo `termId` citado por calculadora ou documento existe no glossário, sem ids duplicados.
- [ ] **CA-25**: Um usuário sem PaymentAccess ADMIN/OWNER não vê a pasta "Documentos da empresa" em `/nbox` nem no seletor do `SEND_NBOX` (manual).
- [ ] **CA-26**: Revelar senha do cofre sem WebAuthn → recusado. Com WebAuthn → segredo exibido e `CompanyCredentialRevealLog` gravado (manual).
- [ ] **CA-27**: O simulador do Forge abre com a alíquota do perfil, salva, recarrega e mantém `taxRateBps`. A proposta gerada tem `taxBreakdown` (manual).
- [ ] **CA-28**: Obrigação vencendo em 5/2/0 dias → sino + WhatsApp nos telefones do perfil + gatilho `COMPLIANCE_ITEM_DUE`. Rodar de novo no mesmo dia não duplica (manual no Inngest dev).
- [ ] **CA-29**: Um XML de fornecedor anexado a uma despesa cria `TaxCredit PENDING_PAYMENT`, que vira AVAILABLE ao pagar e reduz a apuração de CBS/IBS (manual).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lançamento criado por outro módulo (tráfego, Route, Astro) sem passar pelos services | O cron noturno reconcilia os lançamentos alterados nas últimas 26h. |
| CB-2 | Lançamento excluído (hard delete) | A sincronização não encontra a entry e apaga o journal. |
| CB-3 | Categoria sem mapeamento | Usa a conta padrão pelo tipo da categoria (receita/custo/despesa). |
| CB-4 | Conta de sistema apagada à mão | `loadSystemAccounts` recria pelo código padrão. |
| CB-5 | Empresa com < 12 meses | RBT12 proporcional. No mês de início, receita × 12. |
| CB-6 | RBT12 > R$ 3,6 mi / > R$ 4,8 mi | Aviso de sublimite / exclusão do Simples. |
| CB-7 | Reapurar mês já confirmado | Mantém a confirmada; só DRAFT é recalculada. |
| CB-8 | Reabrir apuração com guia paga | Recusado. É preciso estornar o pagamento antes. |
| CB-9 | Nota de entrada emitida pela própria empresa | Não gera crédito (o destinatário tem de ser o CNPJ da org). |
| CB-10 | Mesma nota anexada duas vezes | Idempotente por `[org, accessKey, tax]`. |
| CB-11 | Despesa da nota cancelada | Crédito GLOSSED. |
| CB-12 | Org sem CNPJ cadastrado | Crédito aceito com aviso, e a divergência de CNPJ em documento não é checada. |
| CB-13 | Usuário sem acesso ao Payment no simulador do Forge | Alíquota volta ao modo manual, sem erro visível. |
| CB-14 | Vencimento em sábado/domingo | Antecipa para sexta. Feriados não são tratados na Fase 1. |
| CB-15 | Alíquota estimada (Reforma 2027+) | Aviso "estimada" na memória de cálculo e selo na tabela. |
| CB-16 | Primeiro acesso à aba | O perfil nasce com defaults (Simples, Anexo III, PI/Teresina, ISS 5%). A contabilidade do histórico é gerada ao concluir o onboarding. |

## 6. Decisões de design

### D-1: A contabilidade deriva do financeiro, sem lançamento contábil manual na Fase 1
- **Escolha**: `JournalEntry` é função do `PaymentEntry` (reconstruído a cada mudança).
- **Alternativas descartadas**: escrituração paralela digitada, que duplicaria o trabalho e criaria divergência entre o financeiro e a contabilidade.
- **Consequência**: não existem lançamentos de ajuste nem depreciação contabilizada. Isso fica para a Fase 4.

### D-2: A sincronia do journal é assíncrona e idempotente, não roda dentro da transação do lançamento
- **Escolha**: `queueJournalSync` depois do commit, com Inngest e concorrência 1 por org, mais o cron noturno. O plano previa escrever no mesmo `tx`. Isso foi descartado porque o `PaymentEntry` é alterado por mais de dez caminhos (conciliação, Astro, tráfego, parcelas) e porque a regra 18 manda manter efeitos fora da transação.
- **Consequência**: há um atraso de segundos entre o lançamento e o balancete.

### D-3: Alíquotas em banco, com seed em código provisionado sob demanda
- **Escolha**: `TaxRate` com `seedKey` único, provisionado por upsert na primeira leitura do processo.
- **Consequência**: não depende de alguém rodar seed em cada ambiente. Linhas com `needsVerification` exibem aviso.

### D-4: O catálogo de documentos fica em código, com ajuste por org em banco
- **Escolha**: `COMPANY_DOCUMENT_TYPES` versionado no repositório, mais a tabela `CompanyDocumentRequirement`.
- **Consequência**: toda org recebe documentos novos sem migração de dados.

### D-5: Crédito de IBS/CBS condicionado ao pagamento da despesa
- **Escolha**: o crédito nasce PENDING_PAYMENT e vira AVAILABLE quando a despesa é paga. É uma aproximação da regra da LC 214/2025 (crédito condicionado à extinção do débito), que o split payment tornará automática.

### D-6: Autoexplicação a partir de um glossário único
- **Escolha**: o mesmo glossário alimenta o ⓘ da interface, o ASTRO e o Space Help. Não há texto explicativo solto em componente.

## 7. Impacto

- [x] Schema / migration: `20260929200000_accounting_foundation`, só aditiva.
- [x] Procedures oRPC novas em `accounting.*`.
- [x] Automações (Inngest): `accounting-journal-sync`, `accounting-journal-backfill`, `accounting-nightly`, `detect-compliance-due`.
- [ ] Env vars novas: nenhuma. Usa `AI_SECRETS_KEY` (cofre/certificado) e `NEXT_PUBLIC_APP_URL`.
- [ ] Breaking change: nenhuma. O Forge mantém as linhas "Impostos" nas propostas antigas.
- [x] Documentação: `docs/contabil-overview.md` e regra 21 do CLAUDE.md.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-4 a CA-24 | automatizado (script) | `pnpm tsx scripts/accounting-qa-check.ts` |
| CA-3 | manual | Balancete de um mês com lançamentos reais: selo "Débitos = Créditos". |
| CA-25 a CA-29 | manual | Roteiro em `docs/contabil-overview.md` §Validação. |

## 9. Riscos e rollback

- **Números fiscais errados**: as tabelas marcadas [VERIFICAR] exibem aviso. A memória de cálculo mostra a fonte e a vigência, e a correção é um dado novo em `TaxRate`.
- **Carga no banco com backfill de org grande**: lotes de 200 e concorrência 1 por org.
- **Rollback**: a migration é aditiva. Remover a aba = tirar a entrada do `payment-page.tsx` e as chamadas a `queueJournalSync`, deixando as tabelas órfãs.

### Itens [VERIFICAR]

Confirmar na fonte oficial antes de usar em produção:

1. Salário mínimo de 2026 (R$ 1.621,00?), que muda o DAS-MEI.
2. Teto do INSS 2026 (R$ 8.475,55?).
3. Tabela progressiva do IRRF vigente e redutor da Lei 15.270/2025.
4. Alíquota geral do ISS de Teresina (5%) e alíquotas por item da LC 116.
5. Alíquotas de referência estimadas da CBS (8,8%) e do IBS (17,7%) de 2027 a 2033.
6. Validade padrão das certidões:
   - CND Estadual PI: 60 dias;
   - CND Municipal de Teresina: 90 dias;
   - Certidão simplificada da JUCEPI: 90 dias.
7. URLs da SEFAZ-PI, SEMF Teresina e JUCEPI.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson / Claude | Criada. D-2 diverge do plano (journal assíncrono em vez de dentro do `tx`). |
| 2026-09-29 | Weydson / Claude | RF-17 ampliada (20 tools, roteamento e contexto de subaba). Brechas da pasta restrita fechadas em Spacehome, link público, portal do cliente e ASTRO Command. |
