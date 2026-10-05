# Spec Driven Development (SDD) — N.A.S.A

> Toda mudança relevante nasce como **spec** escrita e revisada. Só depois vira
> código. A spec é o artefato de decisão; o código é a consequência dela.

---

## Por que adotamos isto

O caso que motivou a adoção está registrado em
[`form/0001-form-submit-lead-placement.md`](form/0001-form-submit-lead-placement.md).
Resumo do que aconteceu:

O submit público de formulário passou a **realocar** o lead para o tracking do
form quando o telefone já existia na org. A feature foi direto para o código.
Em produção, o submit começou a devolver **500** — mas só às vezes.

Houve **duas** tentativas de correção. A primeira (PR #369) consertou um 500
real, de causa diferente, e todo mundo considerou o assunto encerrado. O erro
continuou. A causa verdadeira só apareceu depois, ao reproduzir com dados reais:
a resposta do submit depende de **em qual tracking o lead já estava**, e esse
caso nunca foi enumerado em lugar nenhum.

| Situação do lead | O que o código faz | Resultado real |
| --- | --- | --- |
| Já está no tracking do form | reusa, sem escrita | ✅ 200 |
| Está em **outro** tracking | realoca (UPDATE) | ❌ **500** |
| Não existe | cria dentro da transação | ⚠️ 200, mas perde eventos de jornada |

Três caminhos, três comportamentos distintos, **um** deles testado. Uma seção de
"casos de borda" com essas três linhas teria exposto o problema antes da primeira
linha de código — e teria evitado a correção que não corrigia.

**A regra que tiramos disso**: quando uma mudança introduz caminhos condicionais
sobre dados que já existem em produção, esses caminhos são enumerados **antes**.

---

## Estrutura

```
specs/
├── README.md                  # este arquivo — processo e índice
├── TEMPLATE.md                # template padrão de spec
├── <dominio>/                 # espelha src/features/<dominio>/
│   └── NNNN-<slug>.md
└── _arquivadas/               # implementadas há muito tempo ou descartadas
```

Os diretórios de domínio espelham `src/features/<dominio>/`, seguindo a regra de
domínio fechado do [CLAUDE.md](../CLAUDE.md). Uma spec que cruza domínios mora no
domínio **dono** da decisão e cita os outros na seção de impacto.

Numeração `NNNN` é **global e sequencial** (0001, 0002, …), não por domínio —
assim uma spec pode ser citada por número em PR, commit ou conversa sem
ambiguidade: "ver spec 0001".

---

## Os dois pesos de spec

Processo que exige documento longo para tudo morre em duas semanas. Por isso são
dois pesos:

| Peso | Quando | Seções obrigatórias |
| --- | --- | --- |
| **Leve** | Mudança de comportamento pequena, bug com causa já entendida | 1–5 e 9 |
| **Completa** | Feature nova, mudança de schema, integração externa, qualquer coisa com dinheiro/auth/dados de lead | Todas |

### Quando **não** escrever spec

Escrever spec para isto é teatro de processo — não faça:

- Correção de typo, texto de UI, ajuste de estilo
- Refactor sem mudança de comportamento observável
- Bump de dependência
- Bug de uma linha com causa óbvia e sem caminho condicional novo

**O teste decisivo**: _a mudança cria um novo "depende de" sobre dados que já
existem em produção?_ Se sim, escreva a spec — foi exatamente esse tipo de
mudança que gerou o 500 do submit.

### Specs de baseline

Domínio grande e antigo demais para caber numa spec de mudança ganha uma spec
de **baseline**: ela não descreve uma alteração, descreve o **estado atual**
(mapa, invariantes, casos de borda já conhecidos) e serve de leitura
obrigatória antes de mexer ali. Nasce com `status: implementada`.

Baseline é **atualizada**, não substituída: a spec da mudança cita o número da
baseline e registra no changelog dela o que passou a divergir. A primeira é a
[0003](tracking-chat/0003-tracking-chat-baseline.md), do `tracking-chat`.

---

## O fluxo

### 1. Ideia → spec (rascunho)

Abra a branch pela convenção do CLAUDE.md e crie a spec já nela:

```bash
/start <app> <descricao-curta>
```

Copie `TEMPLATE.md` para `specs/<dominio>/NNNN-<slug>.md`, com
`status: rascunho`. Preencha **contexto, objetivo e não-objetivos** primeiro —
se não conseguir escrever o objetivo em uma frase, o problema ainda não está
entendido o suficiente para virar código.

### 2. Spec → revisão

Mude para `status: em-revisao` e abra o PR **só com a spec**, sem implementação.
Revisar 80 linhas de markdown custa minutos; revisar 800 linhas de diff custa uma
tarde — e é tarde demais para discordar do desenho.

O revisor não avalia código. Avalia:

- Os **casos de borda** cobrem os caminhos condicionais sobre dados reais?
- Os **critérios de aceite** são verificáveis, ou são desejos?
- As **decisões de design** registram a alternativa descartada?
- Os **não-objetivos** contêm o escopo?

### 3. Spec aprovada → código

Só aqui começa a implementação, na mesma branch. Regras:

- Cada `CA-n` vira ao menos um teste, citando o id no nome:
  `submit realoca lead de outro tracking (CA-3)`
- Divergiu da spec durante a implementação? **Atualize a spec no mesmo PR** e
  registre no changelog dela. Spec desatualizada é pior que spec nenhuma, porque
  mente com autoridade.

### 4. Entrega

```bash
/ship <mensagem-do-commit>
```

O PR referencia a spec (`Spec: specs/form/0001-....md`) e o corpo lista os `CA-n`
com o que foi verificado. No merge, `status: implementada` e `pr:` preenchido.

### 5. Depois

A spec permanece como registro da decisão. Mudou o comportamento depois? Nova
spec que **substitui** a anterior (`substitui: NNNN` no front-matter) — specs não
são reescritas retroativamente, senão perdem o valor de histórico.

---

## Ciclo de status

```
rascunho ──▶ em-revisao ──▶ aprovada ──▶ implementada
    │             │                            │
    └─────────────┴──────▶ descartada          └──▶ _arquivadas/ (substituída)
```

---

## Índice de specs

| # | Domínio | Título | Status |
| --- | --- | --- | --- |
| [0001](form/0001-form-submit-lead-placement.md) | form | Posicionamento de lead no submit público de formulário | em-revisao |
| [0002](form/0002-formularios-com-escopo-de-action.md) | form | Formulários e respostas com escopo de Action | em-revisao |
| [0003](tracking-chat/0003-tracking-chat-baseline.md) | tracking-chat | Baseline do Tracking Chat — contrato do domínio | implementada |
| [0004](tracking-chat/0004-video-por-script.md) | tracking-chat | Envio de vídeo pelo chat via anexo em Script | implementada |
| [0005](form/0005-bloqueio-edicao-respostas-por-autoria.md) | form | Política configurável de edição de respostas de formulário | em-revisao |
| [0006](form/0006-prefill-de-campos-pela-identificacao.md) | form | Pré-preencher campos do formulário com dados da identificação | rascunho |
| [0007](payment/0007-acesso-financeiro-por-whitelist.md) | payment | Acesso ao módulo financeiro por whitelist, sem senha própria | aprovada |
| [0010](tracking-chat/0010-telefone-br-e-erros-outbound-estruturados.md) | tracking-chat | Corrigir normalização de telefone BR e estruturar erros do outbound | implementada |
| [0011](tracking-chat/0011-filtros-avancados-na-lista-de-conversas.md) | tracking-chat | Filtros avançados e ordenação na lista de conversas do chat | implementada |
| [0014](astro/0014-astro-agente-financeiro-tools-e-confirmacao.md) | astro | Astro como agente financeiro — pack de tools, confirmação e leitura de documentos | em-revisao |
| [0015](astro/0015-astro-widget-flutuante.md) | astro | Painel de chat do Astro no orb flutuante | em-revisao |
| [0016](payment/0016-extrato-pdf-e-conciliacao-pelo-astro.md) | payment | Extrato bancário em PDF e conciliação pelo Astro | em-revisao |
| [0017](payment/0017-lembretes-com-envio-de-boleto.md) | payment | Lembretes que enviam o boleto por WhatsApp e e-mail | em-revisao |
| [0018](payment/0018-caixa-de-entrada-gmail.md) | payment | Caixa de entrada Gmail do financeiro | em-revisao |
| [0019](astro-bot/0019-whatsapp-escopo-financeiro-e-stars.md) | astro-bot | Astro pelo WhatsApp — escopo financeiro, mídia inbound e Stars | em-revisao |
| [0020](stars/0020-catalogo-unico-de-preco-e-ponto-unico-de-cobranca.md) | stars | Catálogo único de preço e ponto único de cobrança de Stars | em-revisao |
| [0021](stars/0021-registro-de-custo-por-evento-e-instrumentacao.md) | stars | Registro de custo por evento e instrumentação das chamadas pagas | em-revisao |
| [0021](trafego/0021-trafego-captura-lead-e-notificacao-admin.md) | trafego | Captura de lead no wizard e notificação do admin | em-revisao |
| [0022](notifications/0022-web-push-notification-service.md) | notifications | Serviço de notificação Web Push | em-revisao |
| [0022](trafego/0022-trafego-pix-asaas.md) | trafego | Cobrança PIX automática pelo Asaas no checkout do trafeGO | rascunho |
| [0023](astro/0023-astro-roteamento-por-intencao-e-proposta-com-link.md) | astro | Roteamento do Astro por intenção, com a proposta comercial como piloto | aprovada |
| [0024](astro/0024-catalogo-de-verbos-do-astro.md) | astro | Catálogo de verbos do Astro — recorte por onda | aprovada |
| [0025](astro/0025-astro-roteamento-em-camadas.md) | astro | Roteamento em camadas — todos os apps sem perder precisão | aprovada |
| [0028](astro/0028-astro-commander.md) | astro | ASTRO COMMANDER — comandos persistentes, execução headless e App ASTRO | aprovada |
| [0029](astro/0029-astro-em-toda-a-plataforma.md) | astro | ASTRO em toda a plataforma — alertas proativos, widget central e botões nos apps | aprovada |
| [0030](tracking-chat/0030-canal-email-no-tracking-chat.md) | tracking-chat | Canal E-mail no Tracking Chat — ler e responder e-mails dos leads pelo Gmail da organização | aprovada |
| [0031](astro/0031-astro-chat-widget-no-site.md) | astro | ASTRO CHAT — widget do ASTRO no site do cliente, com conversas no Chat | aprovada |
| [0032](astro/0032-astro-crud-de-propostas-no-forge.md) | astro | ASTRO faz o CRUD de propostas do Forge — criar guiado, listar, editar, cancelar e excluir | aprovada |
| [0033](astro/0033-astro-busca-data-e-plano-em-pedidos-compostos.md) | astro | ASTRO escolhe por busca, confirma data por extenso e transforma pedido composto em plano | aprovada |
| [0034](tracking-chat/0034-detalhes-do-lead-na-lateral-do-chat.md) | tracking-chat | Detalhes do lead na lateral do chat e selo do canal no avatar | aprovada |
| [0035](leads/0035-auditar-lead-metricas.md) | leads | Auditar Lead — métricas de comportamento e atendimento por lead | aprovada |
| [0036](astro-bot/0036-bot-transcreve-audio.md) | astro-bot | ASTRO no WhatsApp entende áudio (transcrição) | aprovada |
| [0037](notifications/0037-alerta-tokens-ia.md) | notifications | Alertar crédito de IA esgotado e consumo alto de tokens | implementada |
| [0038](tracking-chat/0038-gatilho-do-lead.md) | tracking-chat | Gatilho do lead — mensagem agendada com período de ativação | implementada |
| [0039](workflows/0039-construtor-rapido-de-gatilhos.md) | workflows | Construtor rápido de Gatilhos Automáticos (passo a passo, por frase e por lead) | implementada |
| [0040](campanhas/0040-disparo-em-massa-self-service.md) | campanhas | Disparo em Massa self-service — número oficial, custos, taxa e subida de volume | em-revisao |
| [0046](astro/0046-astro-guia-na-tela.md) | astro | Astro Guia — passo a passo na tela real, com seta e balão | implementada |
| [0047](comments/0047-guia-conectar-instagram-comments.md) | comments | Guia passo a passo para conectar o Instagram no COMMENTS | em-revisao |
| [0048](astro/0048-astro-guia-em-outros-apps.md) | astro | Astro Guia em Chat, Agenda, Forge e Formulários | em-revisao |
| [0049](astro/0049-astro-guia-workspace-financeiro-campanhas-contatos-equipe.md) | astro | Astro Guia em Workspace, Financeiro, Campanhas, Contatos e Equipe | em-revisao |
| [0050](astro/0050-astro-guia-em-todos-os-apps.md) | astro | Astro Guia em todos os apps restantes | em-revisao |
| [0051](accounting/0051-aba-contabil-fundacao.md) | accounting | Aba Contábil — fundação contábil, guias, documentos, créditos e precificação | em-revisao |
| [0069](comments/0069-contas-do-instagram-nos-satelites.md) | comments | Conectar várias contas do Instagram pelos Satélites e escolher a conta no Comments | aprovada |
| [0070](nasa-planner/0070-kits-da-marca-por-conta.md) | nasa-planner | Vários Kits da Marca por empresa, vinculados à conta do Instagram | rascunho |

---

## Integração com o CLAUDE.md

O CLAUDE.md é a fonte de verdade das regras do projeto, e o SDD já está lá:
**item 17**, que aponta para este arquivo. Mudou o fluxo aqui? Confira se o item
17 continua descrevendo a mesma coisa.
