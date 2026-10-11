---
id: 0090
titulo: Gatilhos Automáticos — central, quadros visuais e previsão de erros
dominio: workflows
status: em-revisao
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr: Act962/nasa.ex#454
peso: completa
---

# 0090 — Gatilhos Automáticos: central, quadros visuais e previsão de erros

> O arquivo mantém o nome antigo ("simulador") para não quebrar links. A ideia inicial de um painel de simulação foi substituída por este escopo em 11/10/2026 (ver changelog).

## 1. Contexto

O Órbita tem muitos Apps, e agora o número da API oficial do WhatsApp, com as regras da Meta, é um dos canais principais. O Weydson quer que qualquer pessoa consiga criar e acompanhar automações. Hoje isso esbarra em quatro coisas:

1. **Estão espalhadas.** São sete sistemas em cinco modelos de dados, nenhum com entrada nos Apps nem na barra lateral:

   | Sistema | Onde fica hoje |
   | --- | --- |
   | Fluxos do tracking | Tracking › Gatilhos Automáticos |
   | Automações do workspace | Aba dentro das configurações do workspace |
   | Modo rápido | Janela, na página dos fluxos e no Chat |
   | Gatilhos do lead | Barra lateral do lead, no Chat |
   | Inatividade | Configurações do tracking › Interações |
   | Comandos do ASTRO | App Astro › Comandos |
   | Alertas | App Astro › Alertas |
   | Automações do Comments | App Comments › Automações |

2. **O fluxo não se lê.** Cada quadro é um ícone pequeno; para saber o que uma mensagem diz é preciso abrir o quadro.
3. **O erro só aparece em produção.** A borda vermelha existe pela metade: a mensagem fica escondida num balão, a linha quase nunca acende, a checagem lê o fluxo salvo e não o da tela, e não existe nenhuma regra da API oficial. Nada impede ativar um fluxo quebrado.
4. **Defeito confirmado no nó "Esperar"** em fluxos de modo agente: a tela grava `HOURS` e o motor compara `hours`. "Esperar 2 horas" vira espera zero; dias e semanas esperam errado. Os fluxos criados pelo ASTRO nascem nesse modo.

## 2. Objetivo

Um lugar só, fácil de achar, para ver o que está ativo, criar e corrigir automações; um editor em que o fluxo se lê olhando; e erro previsto antes de ir para o cliente.

### Regra que vale acima de tudo

**Nenhuma automação que funciona hoje pode mudar de comportamento.** Esta spec acrescenta telas e avisos; não migra dado, não troca motor de fluxo existente e não remove nenhum caminho de acesso sem aprovação expressa do Weydson. Toda mudança que altere a execução de fluxos já ativos (hoje só a seção 8) é mostrada com a lista de fluxos afetados antes de ser aplicada.

### Não-objetivos

- Fundir os sete sistemas num motor ou num modelo de dados.
- Apagar ou migrar automações de clientes.
- Quadros visuais no editor do workspace e no do Comments.
- O ASTRO editar por conversa um fluxo que já existe.

## 3. Requisitos

### A. Central (popover e página)

| ID | Requisito |
| --- | --- |
| RF-1 | **Popover "Gatilhos Automáticos"**: é a janela "Novo gatilho" que já existe (`workflows/components/quick-builder/quick-workflow-dialog.tsx`, spec 0039), reaproveitada e aberta por um botão sempre à mão na plataforma (barra lateral e docas dos Apps). Ganha: (a) as **logos** do canal no gatilho e em cada passo (WhatsApp, Instagram, site, catálogo, pagamento); (b) a escolha do funil, quando aberta fora de um tracking; (c) a aba **"Ativos"**, com as automações da empresa, o estado (ativa, inativa, com problema) e o interruptor de ativar; (d) o aviso das regras da API oficial no passo que as infringe. O que a janela faz hoje (frase + "Montar", passos, "Ligar ao criar", "Modo avançado", "Criar gatilho") continua igual, inclusive quando aberta a partir de um lead no Chat |
| RF-2 | **Página "Gatilhos Automáticos"** nos Apps do sistema, com a mesma lista completa, filtros por origem (tracking, workspace, Comments…), por canal e por estado. O popover tem o link "ver tudo" para ela |
| RF-3 | A lista reúne, ao vivo: fluxos de todos os trackings, automações de workspace e do Comments. Gatilhos do lead, inatividade, comandos do ASTRO e alertas entram como cartões com a contagem e o atalho para a tela de cada um |
| RF-4 | Cada linha: nome, de onde é, canal (logo), resumo dos primeiros passos, estado e interruptor. Clicar abre **no editor que a automação já tem** |
| RF-5 | "Criar" oferece: do zero, modo rápido e "Criar fluxo com ASTRO" |
| RF-6 | Os caminhos de acesso atuais continuam existindo. Esconder algum deles é decisão posterior, caso a caso |

### B. Quadros visuais

| ID | Requisito |
| --- | --- |
| RF-7 | Chave "Ícones / Visual" no editor do tracking, lembrada por usuário. "Ícones" é exatamente o desenho de hoje |
| RF-8 | Visual, gatilhos: card do lead no desenho do funil, com "Nome do lead" e o que dispara (tag, etapa, lead novo…) |
| RF-9 | Visual, Enviar Mensagem, Menu de Botões e modelo: celular com a mensagem como o cliente vê, com botões ou lista |
| RF-10 | Visual, demais quadros: ícone, como hoje |
| RF-11 | Selo com a logo da plataforma do quadro (WhatsApp, Instagram, site, catálogo NERP…) |
| RF-12 | Clicar, arrastar, ligar, copiar e configurar funcionam igual nas duas visões |
| RF-13 | A barra mantém "Testar passo a passo", "Clipboard", "Organizar", "Histórico" e "Problemas". "Testar (Rocket-run)" sai da barra (não roda fluxo que começa por tag) |

### C. Previsão de erros

| ID | Requisito |
| --- | --- |
| RF-14 | O diagnóstico roda sobre o que está **na tela**, a cada alteração, sem precisar salvar |
| RF-15 | Quadro com erro: contorno vermelho; as linhas que chegam e saem dele ficam vermelhas; a mensagem aparece **no próprio quadro**, em português claro, com o que fazer |
| RF-16 | Só é **erro** (vermelho) o que é certo que vai falhar. O que pode falhar é **aviso** (amarelo) |
| RF-17 | Regras da API oficial: (a) mensagem livre depois de espera de 24 h ou mais, sem modelo reserva → erro: "Você não pode enviar mensagem para esse lead fora do prazo de 24h. É necessário enviar um template: selecione o template e, depois que o cliente responder, o fluxo volta ao normal."; (b) gatilho que não garante fala recente do cliente, seguido de mensagem livre sem modelo reserva → aviso; (c) Menu de Botões por automação → erro enquanto a seção F não estiver ligada; (d) áudio de voz → erro; (e) mais de 3 botões, mais de 10 linhas, título longo → aviso |
| RF-18 | Outras regras: modelo em número não oficial; funil sem número conectado; quadro avançado em fluxo antigo; tag ou etapa apagada; quadro solto; ramo sem saída |
| RF-19 | O painel "Problemas" lista os mesmos itens; clicar leva ao quadro |
| RF-20 | **Ativar fluxo com erro**: começa só avisando ("este fluxo tem N erros, ativar mesmo assim?"). Bloquear fica atrás do interruptor `WORKFLOW_ACTIVATION_GATE`, desligado até decisão |
| RF-21 | Fluxos já ativos com erro **não são desligados** nem alterados; ganham o selo "com problema" na central |

### D. Criar fluxo com ASTRO

| ID | Requisito |
| --- | --- |
| RF-22 | O botão "Modo Agente IA" passa a ser "Criar fluxo com ASTRO". Ao clicar, o campo de mensagem do ASTRO aparece na base da página dos gatilhos (e da central), com o funil no contexto |
| RF-23 | Ação nova no registro do ASTRO, alcançável por frase em qualquer lugar ("crie um fluxo para…"). Mostra o roteiro, pede confirmação, cria **desligado** e abre no editor |
| RF-24 | O gerador conhece as regras da API oficial e todo fluxo gerado passa pelo diagnóstico da seção C antes de ser criado |
| RF-25 | Fluxo novo nasce com os recursos avançados (condicionais, vários gatilhos, nós de IA). O interruptor some para fluxos novos. **Fluxo existente não muda de modo.** Depende da seção 8 |

### E. Painel lateral de edição (interruptor `WORKFLOW_INSPECTOR`)

| ID | Requisito |
| --- | --- |
| RF-26 | Clicar num quadro abre a configuração num painel à direita. Começa por Enviar Mensagem, Menu de Botões, Esperar e gatilhos; o resto continua em janela até ser migrado |

### F. Uma saída por resposta e botões na API oficial (interruptor `WORKFLOW_META_INTERACTIVE`)

| ID | Requisito |
| --- | --- |
| RF-27 | O Menu de Botões ganha uma saída por opção, mais "sem resposta". Cada saída liga a um próximo passo |
| RF-28 | A automação envia botões (até 3) e lista (até 10) pela API oficial |
| RF-29 | O clique retoma **o mesmo fluxo** pela saída da opção clicada. A tag por botão continua funcionando para os fluxos que já a usam |
| RF-30 | Só em fluxos novos ou em fluxos que a pessoa editar para usar. Nada muda em quem não mexer |

### G. Fazer ligação com IA

| ID | Requisito |
| --- | --- |
| RF-31 | **Agora**: ação "Fazer ligação com IA" que envia ao cliente o convite para ligar e espera a chamada; a assistente atende (spec 0087). Sem tipo de nó novo |
| RF-32 | **Depois** (interruptor `WORKFLOW_OUTBOUND_CALL`): a assistente liga. Exige autorização do cliente pela Meta, limites e número de produção |

## 4. Segurança de dados

| # | Regra |
| --- | --- |
| S-1 | Central e popover só mostram automações da empresa ativa, e só as que a permissão da pessoa alcança (`tracking-automacoes`, `workspace-automacoes`, Comments, Astro) |
| S-2 | Conferir a rota atual de lista de fluxos do tracking: ela valida o tracking, mas não foi achada a checagem de empresa. Se confirmado, corrigir nesta entrega |
| S-3 | Diagnóstico e quadros visuais não enviam nem gravam nada |
| S-4 | ASTRO: fluxo sempre nasce desligado e com confirmação; o texto do pedido é dado, não ordem |
| S-5 | Seção F: o clique é entrada de fora. O id é conferido contra a mensagem enviada àquele lead antes de retomar o fluxo |
| S-6 | Seção G: sem autorização registrada do cliente, não liga; contadores travam antes do limite da Meta |

## 5. Regras da Meta (reler a regra oficial antes de cada fase)

| Regra | Onde entra |
| --- | --- |
| Fora de 24 h da última mensagem do cliente só sai modelo aprovado | RF-17a, RF-17b, RF-24 |
| Interativo: 3 botões, lista de 10 linhas, títulos curtos | RF-17e, RF-28 |
| Conversa só é iniciada com quem autorizou; insistência derruba a qualidade do número | O ASTRO não gera mais de dois lembretes por fluxo sem pedido |
| Ligação iniciada pela empresa: autorização do cliente, 1 pedido por dia e 2 por semana, 4 não atendidas revogam | RF-32 |
| IA de uso geral proibida | Os fluxos gerados ficam no assunto da empresa |

## 6. Critérios de aceite

- [ ] **CA-1** — Todo fluxo salvo no banco de desenvolvimento abre no editor, nas duas visões, e passa pelo diagnóstico sem erro de execução.
- [ ] **CA-2** — Com a chave em "Ícones", o canvas é idêntico ao de hoje.
- [ ] **CA-3** — Mover, ligar, copiar, salvar, ativar, "Testar passo a passo", "Clipboard" e "Organizar" funcionam nas duas visões.
- [ ] **CA-4** — API oficial, espera de 25 h seguida de texto sem modelo reserva: quadro e linhas em vermelho, com a frase do RF-17a. Com modelo reserva: sem erro.
- [ ] **CA-5** — O mesmo fluxo num funil de número não oficial: sem erro.
- [ ] **CA-6** — Corrigir o quadro apaga o vermelho na hora, sem salvar.
- [ ] **CA-7** — Ativar um fluxo com erro mostra o aviso e deixa ativar; um fluxo já ativo com erro continua ativo.
- [ ] **CA-8** — O popover abre de qualquer App, lista as automações da empresa e o interruptor liga e desliga a certa.
- [ ] **CA-9** — Pessoa sem permissão de automações não vê as automações no popover nem na página.
- [ ] **CA-10** — Automação de outra empresa nunca aparece.
- [ ] **CA-11** — Cada linha abre o editor que aquela automação já tinha.
- [ ] **CA-12** — "Criar fluxo com ASTRO" mostra o campo na base da página; o pedido gera o roteiro, pede confirmação e cria o fluxo desligado.
- [ ] **CA-13** — Fluxo antigo (sem modo agente) continua no motor antigo e roda como antes.
- [ ] **CA-14** — Seção F ligada: clicar num botão segue pela saída daquele botão, no mesmo fluxo, em teste real no WhatsApp. Desligada: tudo como hoje.
- [ ] **CA-15** — Seção 8: depois da correção, "Esperar 2 horas" espera 2 horas em fluxo de modo agente.

## 7. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Fluxo com dezenas de mensagens na visão visual | Abaixo de certo zoom, o celular vira um resumo de uma linha |
| CB-2 | Empresa sem nenhuma automação | Central mostra os três jeitos de criar |
| CB-3 | Funil sem número conectado | Aviso no fluxo; regras de API oficial não se aplicam |
| CB-4 | Empresa com dois números, um oficial e outro não | O diagnóstico usa o número do funil daquele fluxo |
| CB-5 | Mensagem sem texto, tag ou etapa apagada | Quadro mostra "sem texto" / "tag removida" com aviso |
| CB-6 | Menu de Botões que usa menu salvo | O celular mostra as opções do menu salvo |
| CB-7 | Pessoa com permissão só em alguns trackings | Vê só os fluxos desses |
| CB-8 | Fluxo existente que já usa tag por botão | Continua igual, com F ligada ou não |
| CB-9 | Dois fluxos com o mesmo gatilho | Aviso de que os dois disparam |

## 8. Correção do nó "Esperar" (muda execução de fluxos existentes)

- **Defeito**: `tracking-executions/components/wait/dialog.tsx` grava `type: "MINUTES" | "HOURS" | "DAYS" | "WEEKS"`; `workflows/lib/run-workflow.ts` e `validate-node.ts` comparam em minúsculas. No modo agente: horas → zero; dias e semanas → só os minutos do horário. O motor antigo (`wait/executor.ts`) está certo.
- **Correção**: `workflows/lib/wait-duration.ts` com `resolveWaitMinutes(action, now)`, usado nos dois arquivos, igual ao motor antigo.
- **Efeito**: fluxos de modo agente que hoje pulam a espera passam a esperar. É o comportamento desenhado, mas é mudança para quem já está em produção.
- **Condição**: só é aplicada depois de o Weydson ver a lista dos fluxos afetados e aprovar.

## 9. Decisões de design

- **D-1 — Central, não fusão.** Reúne e dá acesso; cada automação segue no seu modelo e no seu editor. Alternativa descartada: um motor só (meses, migração de dados de clientes).
- **D-2 — Popover e página.** O popover resolve "o que está ativo?" sem sair da tela; a página serve para filtrar e organizar. Sugestão do Weydson.
- **D-3 — Desenho trocado num lugar só.** Um renderizador por tipo de quadro, plugado nos dois componentes base; os 25 arquivos de quadro não mudam.
- **D-4 — Diagnóstico puro sobre o canvas.** Um módulo sem servidor, alimentado por um resumo do canal (tipo de número, conectado, tem modelos). Alternativa descartada: continuar lendo o fluxo salvo (o erro só apareceria depois de salvar).
- **D-5 — Erro só para o que é certo.** Vermelho em excesso ensina a ignorar.
- **D-6 — O arriscado atrás de interruptor.** Seções E, F e G-depois nascem desligadas.
- **D-7 — Ligação em duas etapas.** O convite usa o que já funciona; a ligação iniciada pela empresa depende de autorização e de número de produção.

## 10. Impacto

- [x] Schema / migration — só na etapa "depois" da seção G (valor novo no enum de tipos de quadro)
- [x] Procedures oRPC — novas, só de leitura: resumo do canal do funil; lista de automações da empresa
- [x] Automações (Inngest) — seção F (evento de clique) e seção 8
- [x] Env vars — `WORKFLOW_ACTIVATION_GATE`, `WORKFLOW_INSPECTOR`, `WORKFLOW_META_INTERACTIVE`, `WORKFLOW_OUTBOUND_CALL`, todas opcionais e desligadas por padrão
- [x] Mudança de comportamento — seção 8; RF-25 (só fluxos novos); RF-24 (o que o ASTRO gera); RF-13 (botão retirado)
- [x] Documentação — `docs/whatsapp-oficial-overview.md` (regras e, na F, o evento de clique), âncoras e guias do ASTRO (Regra 21), `docs/apps-mobile-playbook.md`

## 11. Fases

| Fase | Entrega | Muda automação existente? |
| --- | --- | --- |
| 0 | Esta spec e os leiautes | Não |
| 1 | Correção do "Esperar" (seção 8) | **Sim**, com lista e aval |
| 2 | Previsão de erros (C) | Não |
| 3 | Central: popover e página (A) | Não |
| 4 | Quadros visuais (B) | Não |
| 5 | Criar fluxo com ASTRO (D) | Só fluxos novos |
| 6 | Painel lateral (E) | Não, desligado por padrão |
| 7 | Saída por resposta e botões na API oficial (F) | Não, desligado por padrão |
| 8 | Ligação com IA (G) | Não |

## 12. Plano de testes

Sem runner instalado (Regra 20): scripts e conferência na tela.

| Critério | Como verificar |
| --- | --- |
| CA-1, 4, 5 | `scripts/verify-flow-diagnostics.ts`: fluxos de exemplo e passada somente leitura por todos os fluxos salvos |
| CA-15 | Script com casos de minutos, horas, dias e semanas |
| CA-9, 10 | Script chamando a lista com pessoa sem permissão e com empresa diferente |
| CA-2, 3, 6, 7, 8, 11, 12 | Tela, pelo Weydson |
| CA-13, 14 | Teste real no número de teste da API oficial |

## 13. Riscos e rollback

- **Quebrar automação em produção**: a regra da seção 2; fases 2 a 4 são só de tela e leitura; o que mexe em execução fica atrás de interruptor ou pede aval com lista.
- **Falso erro**: regra D-5; cada regra tem caso no script.
- **Visão visual pesada**: CB-1; a visão de ícones continua sendo a padrão até decisão.
- **Rollback**: cada fase é um commit; os interruptores desligam E, F e G; a chave volta para "Ícones"; a central é só leitura.

## 14. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-10 | Weydson | Criada como "simulador visual em painel" |
| 2026-10-11 | Weydson | **Fase 2 implementada (seção C)**: `workflows/lib/flow-diagnostics.ts` (puro) + `editor/store/atoms.ts` (`flowDiagnosticsAtom`) + `editor/hooks/use-flow-diagnostics.ts`; ligado nos dois quadros base, em `validated-edge.tsx`, em `components/workflow-node.tsx` (mensagem junto do nome, com o atalho que abre a configuração), no painel "Problemas" e no interruptor de ativar (aviso, sem bloquear). O tipo de número vem de `useQueryInstances`, sem rota nova. Divergências: (1) o aviso amarelo "pode estar fora das 24 h" aparece **uma vez por fluxo**, no primeiro envio: sem isso, 37 dos 38 fluxos do banco de desenvolvimento ficariam com aviso em quase toda mensagem; (2) `WORKFLOW_ACTIVATION_GATE` no servidor não foi criado: por ora só o aviso na tela; (3) das regras de RF-18, só "sem número conectado" e "modelo em número não oficial" entraram; tag apagada, quadro solto e ramo sem saída continuam vindo da checagem que já existia. Verificado por `scripts/verify-flow-diagnostics.ts` (19 verificações, incluindo CA-1, CA-4 e CA-5). Aviso próprio para o lembrete depois de "esperar resposta" por um dia ou mais ("sem resposta, não é entregue"), dado no primeiro envio depois de cada espera. No banco de desenvolvimento, se os 38 fluxos estivessem na API oficial: 18 teriam erro certo e 19 só aviso. Falta conferir na tela |
| 2026-10-11 | Weydson | RF-1: o popover da central é a janela "Novo gatilho" já existente, com logos e a aba "Ativos", em vez de um componente novo |
| 2026-10-11 | Weydson | Reescrita. O painel de simulação saiu. Entram a central (popover e página), os quadros visuais com a opção de ícones, a previsão de erros no canvas, o campo do ASTRO na página, o painel lateral, uma saída por resposta e a ligação com IA. Regra nova: nenhuma automação existente muda de comportamento sem aval |
