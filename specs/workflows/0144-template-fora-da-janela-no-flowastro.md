---
id: 0144
titulo: Template aprovado fora da janela de 24h no bloco Enviar mensagem do FlowAstro
dominio: workflows
status: implementada
autor: João Gabriel
criada: 2026-11-27
atualizada: 2026-11-27
branch: feature/flowastro-template-fora-janela-20261127
pr:
peso: completa
---

# 0144 — Template fora da janela de 24h no FlowAstro

## 1. Contexto

Pela API oficial do WhatsApp, a empresa só manda mensagem livre (texto, mídia, botões) até 24 horas depois da última
mensagem do cliente. Fora dessa janela, só sai **modelo de mensagem aprovado pela Meta** (template).

No FlowAstro isso acontece em três casos:
- depois de um bloco **Atraso** longo ("espera 2 dias e manda o lembrete");
- num fluxo **só por disparo**, para um lead que não escreve há dias;
- num bloco de pergunta que esperou o cliente por mais de um dia.

O motor já sabe lidar com isso. Os Gatilhos Automáticos (o editor antigo) mostram duas opções que o FlowAstro não
mostra:
- **Template reserva** (`action.fallbackTemplate`): o bloco manda a mensagem normal se a janela estiver aberta e o
  template se estiver fechada. O executor do modo agente já faz isso (`closedWindowResult` em `apps.ts`), assim como o
  executor clássico, que cuida das mídias.
- **Só template** (`payload.type = "TEMPLATE"`): o bloco sempre manda o template. O executor do modo agente também já
  tem esse ramo.

Percebemos a falta ao montar um fluxo pela IA (MCP, spec 0142): o catálogo não ensina nenhuma das duas, e o editor não
mostra. Hoje um bloco fora da janela falha com "janela de 24h fechada", e o lead para no fluxo. O ManyChat resolve isso
com um seletor no topo do bloco: "Enviar dentro da janela de 24 horas" ou "fora da janela de 24 horas".

## 2. Objetivo

No bloco "Enviar mensagem" do FlowAstro, a empresa escolhe um template para quando a janela estiver fechada, ou faz o
bloco mandar sempre um template. A IA (MCP) consegue o mesmo, sabendo quais templates existem.

### Não-objetivos

- **Botões do template como caminhos do fluxo** (a 2ª imagem do ManyChat: "Quero participar" e "Não quero" com saídas
  próprias). O clique num botão de template chega no webhook como `type: "button"` (com `payload`), e não como
  `interactive`; ligar isso ao fluxo pede uma spec própria. Aqui o template sai e o fluxo segue por "Próximo passo".
- **Criar template novo pelo FlowAstro.** Continua no app de Campanhas, que já cria e acompanha a aprovação.
- **Número fora da API oficial (Uazapi).** Não tem janela, então o seletor não aparece.
- **Resposta privada do Instagram** (a 1ª imagem do ManyChat). O FlowAstro é só WhatsApp.

## 3. Requisitos

### Funcionais

- **RF-1 — Seletor no topo do bloco**, como no ManyChat: "Enviar **dentro da janela de 24h**" (o padrão) ou
  "**sempre como template**". Ele só aparece se algum número do fluxo for da API oficial. Sem número oficial, o bloco
  fica como hoje.
- **RF-2 — Dentro da janela.** As abas de sempre (Texto, Imagem, Vídeo, Áudio, Arquivo) e, embaixo, a chave "Se a
  janela estiver fechada, enviar um template". Ligada, ela mostra o seletor de template e grava `action.fallbackTemplate`.
  Desligada e com a janela fechada, o passo falha, como hoje, e o aviso da chave diz isso.
- **RF-3 — Sempre como template.** As abas somem e fica só o seletor de template. Grava `payload.type = "TEMPLATE"`, e
  o bloco tem só a saída "Próximo passo".
- **RF-4 — Seletor de template.**
  - Reusa `WorkflowTemplateFields`, o mesmo componente dos Gatilhos e de Campanhas.
  - A lista vem do número oficial do fluxo. Com dois ou mais números oficiais, a pessoa escolhe antes de qual número
    quer ver os templates (D-2).
  - As variáveis do template (`{{1}}`, `{{2}}`) aceitam as variáveis do fluxo, como `{{nome}}` e `{{vars.cidade}}`.
- **RF-5 — Cartão no editor.**
  - "Sempre como template": mostra "Template: <nome>".
  - Com template reserva: mostra uma linha a mais, "Fora da janela: <nome>".
  - Template incompleto (sem nome ou com variável vazia): o cartão mostra o aviso de bloco incompleto.
- **RF-6 — Trava ao ligar.** Template incompleto, como reserva ou como envio fixo, impede o fluxo de ligar, pela tela
  e pelo MCP. A checagem reusa `findTemplateProblems` (`validate-node.ts`).
- **RF-7 — MCP.**
  - **Ferramenta nova `flowastro_list_templates({ trackingId })`:** devolve os templates **aprovados** do número, com
    nome, idioma, categoria, o texto do cabeçalho e do corpo, e quantas variáveis cada um tem.
  - **Catálogo de blocos:** ensina `action.fallbackTemplate` e o tipo `TEMPLATE`, e avisa que sem template reserva o
    passo falha fora da janela.
  - **`warningsOfStoredFlow`:** avisa quando um bloco de mensagem vem depois de um Atraso de 24 horas ou mais e não
    tem template reserva. É exatamente o caso que a IA não percebeu.

### Não-funcionais

- **RNF-1:** nenhuma migration, flag ou função nova no Inngest. O executor e o dado já existem.
- **RNF-2:** o executor não muda, a não ser que o teste mostre algum ramo sem suporte (ver 7).

## 4. Critérios de aceite

- **CA-1:** um bloco de texto com template reserva, rodando para um lead com a janela fechada, entrega o template no
  WhatsApp, e o fluxo segue para o próximo bloco.
- **CA-2:** o mesmo bloco, com a janela aberta, entrega o texto, e não o template.
- **CA-3:** um bloco "sempre como template" entrega o template, mesmo com a janela aberta.
- **CA-4:** um fluxo com o template reserva sem nome, ou com uma variável vazia, não liga, e a mensagem diz o que
  falta. O cartão do bloco fica com o aviso de incompleto, e é assim que a pessoa acha o bloco.
- **CA-5:** pelo MCP, `flowastro_list_templates` lista só os aprovados, e um `flowastro_create_flow` com
  `fallbackTemplate` cria o bloco igual ao feito pela tela.
- **CA-6:** num fluxo sem número oficial, o seletor do topo não aparece.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Fluxo com dois números oficiais de contas da Meta (WABA) diferentes | O template é escolhido na lista de um número. Se o lead vier pelo outro número e lá não existir template com o mesmo nome, a Meta recusa e o passo falha com o erro dela. A tela avisa isso quando o fluxo tem mais de um número oficial (D-2). |
| CB-2 | Template pausado ou desativado pela Meta depois de escolhido | O passo falha com o erro da Meta, como em Campanhas. |
| CB-3 | Bloco de botões (espera o clique) com template reserva e janela fechada | Sai o template, e o fluxo segue por "Próximo passo", sem esperar o clique, porque o template não tem os botões do bloco. É o comportamento atual do executor. |
| CB-4 | Trocar de "sempre como template" para "dentro da janela" | O conteúdo antigo do bloco volta vazio (texto em branco), e o template escolhido vira o template reserva, para não perder o trabalho. |
| CB-5 | Número do fluxo deixa de ser oficial | O seletor some, mas o dado fica guardado. "Sempre como template" falha no envio com a mensagem de template não suportado de hoje (`assertTemplateSupported`). |
| CB-6 | Template com cabeçalho de mídia | O mesmo suporte do `WorkflowTemplateFields` de hoje. Se ele não aceitar cabeçalho de mídia, o template não aparece na lista ou aparece desabilitado, com o motivo. |

## 6. Decisões de design

### D-1 — Só tela e MCP; o motor fica como está
`fallbackTemplate` e `TEMPLATE` já rodam no modo agente e no clássico. Refazer seria duplicar. O que muda é o editor
do FlowAstro, o catálogo e as ferramentas do MCP, e a trava ao ligar.

### D-2 — Templates do número, não do fluxo
Template é da conta da Meta (WABA), e um fluxo pode atender números de contas diferentes. Mostrar a união das listas
esconderia que um nome não existe numa das contas. Por isso a lista é de um número escolhido, com aviso quando há mais
de um oficial. **Alternativa descartada:** um template por número dentro do bloco. Resolve o CB-1, mas pede um dado
novo (um mapa de número para template) e uma tela mais complexa para um caso raro hoje. Revisitar se aparecer cliente
com dois números oficiais de contas diferentes no mesmo fluxo.

### D-3 — Seletor no topo, como o ManyChat
"Dentro da janela" ou "sempre como template" é a primeira decisão do bloco e muda o que aparece embaixo. Uma chave
escondida no fim do painel repetiria o problema de hoje: a pessoa (ou a IA) não percebe que precisa dela.

## 7. Impacto

- **Editor:**
  - `block-panel.tsx`: o seletor do topo, a chave do template reserva e o seletor de template;
  - `block-preview.ts`;
  - o `flow-editor` passa os números do fluxo para o painel.
- **Trava ao ligar:** `flow-commands.ts` (`setAttendanceFlowActive`), reusando `findTemplateProblems`.
- **MCP:**
  - `flowastro-mcp-tools.ts`: `flowastro_list_templates`;
  - `mcp-format.ts`: o catálogo e o aviso de bloco sem template reserva depois de um Atraso;
  - as instruções do app no `apps.ts` do MCP.
- **Executor:** nenhuma mudança esperada. O teste confere o ramo `TEMPLATE` e o `fallbackTemplate` em mídia
  (IMAGE, VIDEO, AUDIO, DOCUMENT), que passa pelo executor clássico.
- **Docs:** `docs/whatsapp-oficial-overview.md` (regra 14), changelog da spec 0139, e a spec 0142 (ferramenta nova).

## 8. Plano de testes

- CA-1 a CA-3 com o número oficial de teste. Para fechar a janela sem esperar 24 horas, usar um lead que não escreve há
  mais de um dia.
- CA-4 e CA-6 no editor.
- CA-5 pelo MCP, com a chave local.
- **Regressão:** fluxo antigo sem template continua igual. Os Gatilhos Automáticos (o editor antigo) não mudam.

## 9. Riscos e rollback

- **Risco:** um template escolhido na conta errada (CB-1). Mitigação: o aviso na tela e o erro da Meta no histórico da
  execução.
- **Rollback:** reverter o PR. Os blocos que já tiverem `fallbackTemplate` continuam funcionando, porque o motor já
  entende esse dado.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-27 | João Gabriel | Rascunho a partir dos exemplos do ManyChat e da falha notada ao montar um fluxo pelo MCP. |
| 2026-11-27 | João Gabriel | Aprovada e implementada. Sem mudança no executor. A listagem de templates saiu da rota para `loadApprovedTemplates`, que a tela e o MCP usam, e `findTemplateProblems` passou a ser exportada. O seletor do topo também aparece quando o bloco já tem template sem número oficial, para dar para voltar. Falta o envio real (CA-1 a CA-3). |
