---
id: 0021
titulo: Registro de custo por evento e instrumentação das chamadas pagas
dominio: stars
status: rascunho
autor: João Gabriel
criada: 2026-09-18
atualizada: 2026-09-18
branch: feature/stars-registro-de-custo-20260918
pr:
peso: completa
---

# 0021 — Registro de custo por evento e instrumentação das chamadas pagas

---

## 1. Contexto

O negócio precisa responder **"quanto custa atender esta organização?"**. Hoje não há resposta.

### Evidência — o que medimos hoje

| Domínio de custo | Situação |
| --- | --- |
| IA — chatbot de tracking | **ESTIMADO** — tokens gravados; custo calculado na leitura, nunca persistido |
| IA — workflows | **ESTIMADO**, e cego quando o workflow é de organização em vez de tracking |
| IA — ASTRO (app e WhatsApp) | **NÃO MEDIDO** |
| IA — demais ~25 pontos de chamada | **NÃO MEDIDO** |
| WhatsApp / Instagram / Facebook | **NÃO MEDIDO** |
| Storage | **NÃO MEDIDO** — o custo de upload de vídeo é calculado e descartado |
| Imagem, vídeo, transcrição, e-mail, realtime | **NÃO MEDIDO** |

Apenas 2 dos ~30 pontos de chamada de IA gravam uso, e a tabela de gravação exige vínculo com um
tracking — o que **estruturalmente** exclui ASTRO, planner, route e workflows de organização, que
são justamente o gasto que precisamos ver.

Pior: a tabela de preço em dólar é de outubro/2024 e **não tem entrada para os modelos default de
hoje**, devolvendo zero para eles. Na prática, mesmo o "ESTIMADO" está estimando zero nos casos
mais comuns.

**A dor:** qualquer decisão de preço tomada agora seria chute com aparência de cálculo. A proposta
comercial original pedia simulações de escala — sem esta spec, essas simulações produziriam números
fabricados.

## 2. Objetivo

Todo evento que gera custo externo registra quanto custou, para quem, em qual solução, com qual
fornecedor e modelo — permitindo apurar custo e margem por organização, solução, feature, usuário,
fornecedor, modelo, dia e mês.

### Não-objetivos

- **Não define nem altera preço de nada.** Esta spec produz o dado; a decisão de preço vem depois,
  com 60 a 90 dias de histórico.
- **Não constrói dashboard**, nem o do cliente nem o do administrador. Ambos dependem de este dado
  existir primeiro.
- **Não faz simulação de escala.**
- Não substitui a telemetria de IA que já existe e alimenta uma tela viva — ela continua como está,
  e o novo registro é escrito **em adição**.
- Não instrumenta custo de infraestrutura própria (servidor, banco, banda) — fica estimado, e a
  marcação deixa isso explícito.
- Não corrige os vazamentos de receita — Fase 5.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Existe um registro de evento de uso por organização, com fornecedor, modelo, quantidade, custo em dólar, custo em real, câmbio usado e quantas ★ foram cobradas |
| RF-2 | O registro **não** exige vínculo com tracking — ASTRO, planner e workflows de organização precisam caber |
| RF-3 | O registro grava também a ação que saiu **gratuita** e a que **falhou por saldo** — ambas custaram dinheiro no fornecedor |
| RF-4 | O registro guarda a origem do preço usado: tabela, catálogo, estimativa ou desconhecido |
| RF-5 | O extrato de Stars passa a guardar **qual usuário** gastou e **qual ação** originou o gasto |
| RF-6 | A tabela de preço em dólar passa a cobrir os modelos realmente em uso, e sinaliza modelo sem preço em vez de devolver zero |
| RF-7 | O câmbio dólar/real sai do código e passa a ser configurável sem deploy |
| RF-8 | Existe um envolvedor único que registra uso e custo de uma chamada de IA, para não repetir integração em cada ponto |
| RF-9 | Ficam instrumentados, nesta ordem: ASTRO no app, ASTRO no WhatsApp, chatbot de tracking, workflows, e o envio de mensagem (WhatsApp/Instagram/Facebook) |
| RF-10 | É possível apurar custo por organização, solução, feature, usuário, fornecedor, modelo, dia e mês |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **A gravação do registro acontece fora da transação de débito** e nunca lança — falha de telemetria não pode derrubar cobrança já persistida (Regra 18 do CLAUDE.md) |
| RNF-2 | A gravação não adiciona latência perceptível ao caminho do usuário |
| RNF-3 | A migration é estritamente aditiva; nenhum saldo ou extrato existente é reescrito |
| RNF-4 | O custo fica persistido no momento do evento, não recalculado na leitura — mudar a tabela de preço depois não pode reescrever o passado |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma conversa com o ASTRO no app, quando ela termina, então existe um registro
      com modelo, tokens, custo em dólar maior que zero e origem do preço igual a "tabela".
- [ ] **CA-2** — Dada uma conversa com o ASTRO pelo WhatsApp, quando ela termina, então existe
      registro equivalente.
- [ ] **CA-3** — Dado um workflow **de organização** (sem tracking), quando executa um nó de IA,
      então o uso é registrado — hoje esse caso é cego.
- [ ] **CA-4** — Dada uma ação sem preço cadastrado, quando disparada, então existe registro com
      zero ★ cobradas e o custo de fornecedor preenchido.
- [ ] **CA-5** — Dada uma cobrança que falha por saldo insuficiente, quando o fornecedor já foi
      chamado, então o custo fica registrado mesmo sem cobrança.
- [ ] **CA-6** — Dada uma chamada com modelo fora da tabela de preço, quando registrada, então a
      origem do preço é "desconhecido" — e **não** custo zero.
- [ ] **CA-7** — Dado um débito de Stars feito por um usuário identificado, quando consultado o
      extrato, então o usuário aparece.
- [ ] **CA-8** — Dada uma falha na gravação do registro, quando ela ocorre, então a cobrança
      permanece válida e o erro só aparece no log.
- [ ] **CA-9** — Nenhuma escrita de registro acontece dentro da transação de débito (verificável
      por inspeção do código).
- [ ] **CA-10** — É possível responder, por consulta, o custo total de uma organização no mês,
      quebrado por solução e por modelo.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Fornecedor não devolve contagem de tokens | Registra o evento com quantidade nula e origem do preço "desconhecido". Nunca registra custo zero como se fosse fato |
| CB-2 | Chave própria da organização (BYO) | Registra o uso, marca que a chave é do cliente, e o custo **para nós** é zero. Sem a marca, superestimaríamos nosso custo |
| CB-3 | Modelo novo que ninguém cadastrou na tabela de preço | Origem "desconhecido"; entra num relatório de modelos sem preço |
| CB-4 | Chamada que falha no fornecedor depois de consumir tokens | Registra com status de erro e o custo consumido |
| CB-5 | Resposta em streaming interrompida pelo usuário | Registra o que foi contabilizado até a interrupção |
| CB-6 | Gravação do registro falha (banco indisponível) | Cobrança permanece; só log. Nunca propaga |
| CB-7 | Sub-agentes do ASTRO dentro de uma mesma conversa | Um registro por chamada ao modelo, identificando qual agente — senão o custo do orquestrador esconde o dos sub-agentes |
| CB-8 | Mesma chamada tentada em dois fornecedores por fallback | Um registro por tentativa; as duas custaram |
| CB-9 | Câmbio alterado no meio do mês | Cada registro guarda o câmbio usado naquele momento. O passado não é reescrito |
| CB-10 | Ação gratuita por decisão do admin (preço zero explícito) | Registra o custo de fornecedor com zero ★ cobradas — é exatamente o caso que revela prejuízo |
| CB-11 | Organização isenta (escopo trafeGO) | Registra custo normalmente. Isenção é de cobrança, não de medição |
| CB-12 | Refill de moderador e ajustes manuais no extrato | **Excluídos de toda apuração de custo unitário** — distorcem qualquer média |
| CB-13 | Volume de registros cresce muito | Índices por organização e data desde o início; política de retenção fica como questão aberta |

## 6. Decisões de design

### D-1 — Registro novo, em vez de estender a telemetria de IA existente

- **Escolha**: criar um registro genérico de evento de uso, e manter a telemetria atual intacta.
- **Alternativas descartadas**: estender a tabela atual. Descartada porque ela exige vínculo
  obrigatório com tracking — o que exclui ASTRO, planner, route e workflows de organização, ou
  seja, exatamente o gasto que queremos ver. Afrouxar esse vínculo mexeria numa tabela que alimenta
  uma tela em produção.
- **Consequência**: as duas convivem por um tempo. A convergência fica para depois, deliberadamente.

### D-2 — Gravar fora da transação de débito

- **Escolha**: debitar primeiro, registrar depois do commit, sem poder lançar.
- **Alternativas descartadas**: gravar dentro da transação, para garantir consistência. Descartada
  pela Regra 18 do CLAUDE.md, escrita em cima de um incidente real: trabalho extra dentro da
  transação de débito já causou 500 em produção neste projeto.
- **Consequência**: aceita-se perder um registro raro em vez de arriscar a cobrança. É a troca
  certa — telemetria é observação, cobrança é dinheiro.

### D-3 — Persistir o custo no momento do evento

- **Escolha**: gravar o custo calculado, junto com o câmbio e a origem do preço.
- **Alternativas descartadas**: calcular na leitura, como hoje. Descartada porque torna o histórico
  irreconstruível: basta alguém atualizar a tabela de preço e todo o passado muda de valor
  retroativamente.
- **Consequência**: o custo histórico fica auditável e estável.

### D-4 — Registrar também o gratuito e o que falhou

- **Escolha**: todo evento que chamou fornecedor gera registro, mesmo com zero ★ cobradas.
- **Alternativas descartadas**: registrar só o que foi cobrado. Descartada porque é exatamente o
  caso não cobrado que revela prejuízo — `astro_prompt` custou meses de IA sem cobrar nada, e nada
  no sistema apontou isso.
- **Consequência**: passamos a enxergar o custo que não vira receita.

### D-5 — Tabela de preço em dólar continua no código; só o câmbio vai para configuração

- **Escolha**: preço por modelo fica versionado no código; o câmbio fica configurável.
- **Alternativas descartadas**: mover tudo para o banco. Descartada porque preço errado no código é
  um diff visível em revisão, e preço errado no banco é invisível. Já o câmbio é o número que
  realmente varia e que o financeiro precisa ajustar sem deploy.
- **Consequência**: mudar preço de modelo exige deploy. Aceito — é raro e merece revisão.

### D-6 — Marcar explicitamente quando a chave é do cliente

- **Escolha**: registrar se a chamada usou chave própria da organização.
- **Alternativas descartadas**: ignorar a distinção. Descartada porque nesses casos o custo para
  nós é zero, e não marcar superestimaria o próprio custo — levando a preço mais alto do que o
  necessário.
- **Consequência**: a margem por organização fica correta.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — aditiva: registro novo + duas colunas no extrato
- [ ] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest) — nós de IA de workflow passam a registrar
- [x] Env vars novas — nenhuma obrigatória; o câmbio migra para configuração no banco
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória — `docs/BILLING_ARCHITECTURE.md` (changelog no mesmo PR) e
      `docs/ASTRO_PROGRESS.md` (corrigir a afirmação de provider padrão)

**Depende de:** spec [0020](0020-catalogo-unico-de-preco-e-ponto-unico-de-cobranca.md), porque o
registro nasce do mesmo ponto único de cobrança.

**Ritual obrigatório após a migration** (Regra 11 do CLAUDE.md): regenerar o cliente Prisma →
bumpar a versão de schema → registrar a migration no histórico → tocar as rotas catch-all →
validar por requisição antes de devolver o controle. Sem o bump, o registro novo fica indefinido em
tempo de execução.

## 8. Plano de testes

Sem test runner instalado (Regra 20 do CLAUDE.md), o aceite é **manual e declarado**.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Conversar com o ASTRO e consultar o registro gerado |
| CA-2 | manual | Mesma conversa pelo WhatsApp |
| CA-3 | manual | Executar workflow de organização com nó de IA; conferir que gerou registro |
| CA-4 | manual | Disparar ação sem preço; conferir registro com zero ★ e custo preenchido |
| CA-5 | manual | Zerar saldo de uma organização de teste e disparar ação de IA |
| CA-6 | manual | Forçar modelo fora da tabela; conferir origem "desconhecido" |
| CA-7 | consulta | Conferir que os débitos novos trazem o usuário no extrato |
| CA-8 | manual | Simular falha na gravação; conferir que a cobrança persiste |
| CA-9 | inspeção | Revisão de código do caminho de cobrança |
| CA-10 | consulta | Apurar custo do mês de uma organização, quebrado por solução e modelo |

## 9. Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Gravação na transação por descuido, causando 500 | Revisão explícita de CA-9; a Regra 18 existe por causa de um incidente igual |
| Volume de registros pesar no banco | Índices desde o início; retenção como questão aberta antes de escalar |
| Custo persistido errado por tabela de preço desatualizada | A origem do preço é gravada; dá para reprocessar só os marcados como "desconhecido" |
| Dupla contagem entre a telemetria antiga e o registro novo | São sistemas separados; toda apuração de custo usa apenas o registro novo |
| Superestimar custo ao ignorar chave do cliente | Marcação explícita de chave própria (D-6) |
| Refills de moderador contaminarem a média | Ajustes manuais excluídos de toda apuração (CB-12) |

**Rollback:** a migration é aditiva. Reverter o código faz o sistema parar de gravar; o registro
acumulado até ali continua consultável, e nenhum saldo ou extrato foi alterado. As duas colunas
novas no extrato ficam nulas nas linhas antigas e não são obrigatórias em nenhum caminho.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-18 | João Gabriel | Criada, com o inventário de 2026-09-18 como base factual |
