---
id: 0090
titulo: Simulador visual dos Gatilhos Automáticos
dominio: workflows
status: em-revisao
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/workflows-simulador-visual-20261010
pr: # preenchido ao abrir a PR
peso: completa
---

# 0090 — Simulador visual dos Gatilhos Automáticos

## 1. Contexto

Montar um fluxo em Gatilhos Automáticos exige abrir nó por nó para saber o que ele faz, e não existe lugar que mostre a conversa que o fluxo produz. Os testes de hoje:

| Onde | O que faz | Limite |
| --- | --- | --- |
| Fluxo de atendimento › Geral › Testar (spec 0089) | Celular simulado do atendimento da assistente | Não cobre os Gatilhos Automáticos |
| Testar (Rocket-run), no editor | Execução de mentira no servidor (`router/workflow/dry-run.ts`) | Só modo agente; lê o que está salvo; manda gatilho fixo "manual" e nenhum lead, então fluxo que começa por tag não roda; resultado em JSON cru |
| Testar passo-a-passo, no editor | Valida um nó por vez (`router/workflow/step-node.ts`) | Não mostra o conteúdo de nenhuma mensagem |

Além disso, as restrições da API oficial do WhatsApp (janela de 24 h, modelo aprovado, menu de botões barrado em automação, áudio de voz) só aparecem quando o fluxo falha em produção.

## 2. Objetivo

No editor do fluxo, um botão "Simular" abre um painel com um celular (a conversa como o cliente vê) e o card do lead (tags e etapa mudando), tocando o fluxo passo a passo sem enviar nem gravar nada, com as restrições da API oficial visíveis. O ASTRO cria um fluxo por comando e abre nele.

### Não-objetivos

- Mudar o motor de execução (`workflows/lib/run-workflow.ts`), os executores ou o formato dos nós.
- Mexer nos botões "Testar (Rocket-run)" e "Testar passo-a-passo".
- Liberar o envio de menu de botões por automação na API oficial (entrega própria, com teste real).
- O ASTRO editar por conversa um fluxo que já existe.
- Executar de verdade IA, e-mail, proposta, HTTP e afins: aparecem como passo não simulado.
- Tabela, migration ou rota de gravação nova.
- Corrigir o nó "Esperar" no modo agente (seção 9, item fora do escopo).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Botão "Simular" na barra do editor. Abre um painel à direita do canvas; em tela estreita, ocupa a tela toda. Desligado enquanto o "passo-a-passo" está ativo |
| RF-2 | A simulação lê o **desenho atual do canvas**, inclusive o que não foi salvo. Se o desenho mudar durante a simulação, aparece "o desenho mudou" com o botão de reiniciar |
| RF-3 | **Celular**: balões no visual do WhatsApp para texto, imagem, documento, menu de botões (até 3), lista (até 10) e modelo. Variáveis (`{{nome}}`, `{{lead.name}}`…) trocadas pelos dados do lead escolhido |
| RF-4 | **Card do lead**: nome, telefone, etapa e tags, no visual do card do funil. Tag que entra ou sai e mudança de etapa aparecem no card no momento do passo |
| RF-5 | **Gatilho**: o início mostra o que dispara o fluxo. Em "tag inserida", a tag entra no card; em "mudou de etapa", o card muda; nos demais, uma linha com o nome do gatilho. Fluxo com mais de um gatilho: a pessoa escolhe por qual começar |
| RF-6 | **Esperar**: separador de tempo ("2 dias depois") e o relógio da simulação avança |
| RF-7 | **Esperar evento**: pergunta "o cliente respondeu?". Sim marca a fala do cliente no relógio (reabre a janela de 24 h); não avança o tempo limite configurado. O caminho seguinte é o mesmo nos dois casos, como no motor |
| RF-8 | **Condicional**: avalia sozinho quando todos os campos se resolvem na simulação; senão pergunta "verdadeiro ou falso?". Ligação saindo pela saída comum de um condicional é marcada como "nunca roda" |
| RF-9 | **Clique em botão com tag**: a tag entra no card; se houver no mesmo canvas um gatilho "tag inserida" com ela, a simulação segue por ele; senão mostra em quais outros fluxos ela dispara (`useReferencedWorkflows`) |
| RF-10 | **Tag, mover lead, temperatura, responsável**: mudam o card. **Demais nós**: linha neutra com o nome do passo e "não simulado" |
| RF-11 | **Tipo de número**: faixa no topo do painel dizendo se o funil usa a API oficial ou número não oficial (`useQueryInstances`) |
| RF-12 | **Janela de 24 h** (API oficial): no início, a pessoa responde "o cliente falou nas últimas 24 h?" (padrão não; gatilho "lead novo" vindo do WhatsApp começa com a janela aberta). Mensagem livre fora da janela aparece como **não entregue**, com "fora da janela de 24 h: precisa de modelo aprovado". Com modelo reserva configurado no nó, mostra o modelo sendo enviado |
| RF-13 | **Menu de botões por automação** na API oficial: balão esmaecido com "a automação não envia menu de botões na API oficial" |
| RF-14 | **Áudio de voz** na API oficial: aviso "só em número não oficial" |
| RF-15 | **Limites**: mais de 3 botões vira lista; mais de 10 opções, título acima de 20 (botão) ou 24 (lista) caracteres geram aviso no balão |
| RF-16 | **Leads**: funil sem leads usa os exemplos Suellen, Ellen, Nicolas, Bryan e Eloá (só na tela). Com leads, a pessoa escolhe um real, somente leitura |
| RF-17 | **Envio para outro número** (não o lead): nota "enviado para outro número", fora da conversa |
| RF-18 | O nó em execução fica destacado no canvas; clicar num passo do painel leva ao nó |
| RF-19 | Controles: iniciar, próximo passo, reiniciar, trocar de lead |
| RF-20 | Painel "Problemas" passa a listar as mesmas restrições da API oficial, como aviso (não bloqueia salvar nem ativar) |
| RF-21 | O "Testar" do Fluxo de atendimento passa a usar os mesmos componentes de celular e conversa |
| RF-22 | **ASTRO**: ação `workflow.create_from_description` no registro de ações. Pedidos como "crie um fluxo/automação/gatilho para…" caem nela. Pergunta o funil quando há mais de um, mostra o roteiro, pede confirmação, cria **desligado** e responde com o link do editor já em modo Simular |
| RF-23 | A geração de fluxo do ASTRO passa a conhecer as regras da API oficial: modelo reserva em mensagem depois de espera longa, janela de 24 h, limites de botões e tag por botão |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A simulação roda no navegador, sem chamada de gravação. Nenhuma mensagem, tag, lead, execução ou cobrança é criada |
| RNF-2 | Interpretador puro (sem React, sem banco), para ser verificado por script |
| RNF-3 | Laço no desenho não trava: no máximo 5 passagens por nó, depois "o fluxo se repete aqui" |
| RNF-4 | Cores por token do tema; componentes de celular e conversa sem dependência de domínio |
| RNF-5 | Nada novo no caminho de quem não clica em "Simular": o editor carrega e salva como hoje |

## 4. Segurança de dados

| # | Regra | Como |
| --- | --- | --- |
| S-1 | Nada sai da plataforma | A simulação não chama provedor de WhatsApp, IA, e-mail nem webhook |
| S-2 | Leads reais só para quem já os vê | A lista usa a consulta de leads que a tela do funil já usa, com as mesmas permissões; nenhuma rota nova |
| S-3 | Leads de exemplo nunca são gravados | Vivem em constante do código e no estado da tela |
| S-4 | Ação do ASTRO com a permissão das automações | `tracking-automacoes`, ação `create`, a mesma da ferramenta atual; recusa única da spec 0082 |
| S-5 | Fluxo criado pelo ASTRO nasce desligado | `isActive: false`, como hoje em `createWorkflowFromBlueprint` |
| S-6 | Texto do pedido é dado | O gerador só devolve o desenho; quem grava é o código, depois da confirmação |

## 5. Regras da Meta (conferir a regra oficial de novo antes do código)

| Regra | Efeito aqui |
| --- | --- |
| Fora de 24 h da última mensagem do cliente só sai modelo aprovado | RF-12; o fluxo gerado pelo ASTRO põe modelo reserva depois de espera longa (RF-23) |
| Mensagem interativa: até 3 botões, lista de até 10 linhas, títulos curtos | RF-13, RF-15 |
| Conversa só é iniciada com quem autorizou; insistência derruba a qualidade do número | O ASTRO não gera mais de dois lembretes por fluxo sem a pessoa pedir |
| Categoria do modelo (utilidade × marketing) | O simulador mostra o nome do modelo; não inventa conteúdo de modelo que não existe |

## 6. Critérios de aceite

- [ ] **CA-1** — Fluxo "tag inserida → mensagem": ao iniciar, a tag aparece no card e o balão aparece no celular com o nome do lead trocado.
- [ ] **CA-2** — Durante toda a simulação, nenhuma requisição de gravação sai do navegador e nenhuma linha é criada em mensagens, tags do lead ou execuções.
- [ ] **CA-3** — API oficial, janela fechada, mensagem livre sem modelo reserva: balão "não entregue" com o aviso das 24 h. Com modelo reserva: balão de modelo.
- [ ] **CA-4** — API oficial, espera de 2 dias seguida de mensagem livre: aviso das 24 h, mesmo que a janela começasse aberta.
- [ ] **CA-5** — API oficial, nó de menu de botões: balão esmaecido com o aviso. Número não oficial: botões clicáveis.
- [ ] **CA-6** — Condicional com as duas saídas ligadas: escolher "falso" segue só pela saída falsa.
- [ ] **CA-7** — Clique em botão com tag: a tag entra no card e o gatilho "tag inserida" do mesmo canvas é seguido.
- [ ] **CA-8** — Desenho com laço termina com "o fluxo se repete aqui", sem travar.
- [ ] **CA-9** — Nó sem simulação (ex.: IA decide) vira linha "não simulado" e a simulação continua pela saída comum.
- [ ] **CA-10** — Funil sem leads oferece Suellen, Ellen, Nicolas, Bryan e Eloá; nenhum deles aparece no funil depois.
- [ ] **CA-11** — Alterar um nó durante a simulação mostra "o desenho mudou".
- [ ] **CA-12** — Os botões "Testar (Rocket-run)" e "Testar passo-a-passo" funcionam como antes; salvar e ativar o fluxo também.
- [ ] **CA-13** — Todos os fluxos salvos no banco de desenvolvimento passam pelo interpretador sem erro.
- [ ] **CA-14** — "Crie um fluxo para quem perguntar de catarata" ao ASTRO: mostra o roteiro, pede confirmação, cria desligado e devolve o link do editor em modo Simular.
- [ ] **CA-15** — Membro sem permissão de automações recebe a recusa única.

## 7. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Canvas sem gatilho | "Este fluxo ainda não tem gatilho" e nada toca |
| CB-2 | Gatilho sem nada ligado | Mostra o gatilho e "o fluxo termina aqui" |
| CB-3 | Nó com campos vazios (mensagem sem texto) | Balão "mensagem sem texto" com aviso, e segue |
| CB-4 | Menu de botões que usa um menu salvo | Carrega o menu pelo hook existente; se não houver, balão "menu salvo" sem as opções |
| CB-5 | Tag ou etapa apagada | Nome "tag removida" / "etapa removida" no card, com aviso |
| CB-6 | Funil sem número conectado | Faixa "sem número conectado"; simula sem as regras de API oficial |
| CB-7 | Fluxo de modo clássico e de modo agente | Os dois são lidos: o interpretador aceita os dois formatos de dados dos nós |
| CB-8 | Variável desconhecida no texto | Fica como está, destacada, com aviso |
| CB-9 | Espera em meses ou semanas | Convertida para o relógio; separador com a unidade original |
| CB-10 | Fluxos já existentes em produção | Só leitura; nenhum dado antigo muda de forma nem de comportamento |

## 8. Decisões de design

### D-1 — Interpretador no navegador, não o motor em modo de mentira

- **Escolha**: função pura que lê nós e ligações do canvas.
- **Alternativas descartadas**: ampliar o `dry-run` do servidor (só existe para modo agente, lê o salvo, vários executores ainda gravam em modo de mentira, e mexeria no motor); rodar o fluxo de verdade com um lead falso (envia e cobra).
- **Consequência**: a simulação pode divergir do motor em detalhes. O painel se chama "Simulação" e o que não é simulado é dito, não adivinhado.

### D-2 — Painel próprio, sem tocar no passo-a-passo

- **Escolha**: estado próprio do simulador.
- **Alternativas descartadas**: reaproveitar o estado do passo-a-passo (ele acende ligações e foguetes no canvas; os dois modos brigariam).

### D-3 — Restrições como regra pura compartilhada

- **Escolha**: um módulo `official-api-rules` usado pelo simulador e pelo painel "Problemas".
- **Alternativas descartadas**: importar as checagens do servidor (dependem do banco) ou repetir a regra em cada tela.
- **Consequência**: os limites ficam declarados em um lugar só no lado da tela; se a regra do servidor mudar, este módulo muda junto (registrado no changelog).

### D-4 — Card de apresentação, não o card do funil

- **Escolha**: `LeadCardPreview` novo, com o mesmo visual de tags.
- **Alternativas descartadas**: usar `lead-item.tsx` (depende de arrastar, lojas de estado e gravação; não roda fora do quadro).

### D-5 — Ação do ASTRO sobre a geração que já existe

- **Escolha**: extrair a função de `generate_workflow_from_intent` e chamá-la pela ação nova e pela ferramenta atual.
- **Alternativas descartadas**: segunda implementação de geração.

## 9. Impacto

- [ ] Schema / migration — **não**
- [ ] Procedures oRPC — nenhuma nova nas fases 1 a 5; a fase 6 usa a geração existente
- [ ] Automações (Inngest) — não
- [ ] Env vars novas — não
- [x] Mudança de comportamento — **RF-23**: o ASTRO passa a gerar fluxos com modelo reserva e limites da API oficial, para todas as empresas. **RF-20**: avisos novos no painel "Problemas"
- [x] Documentação — âncora de guia no botão "Simular" e guia do ASTRO (Regra 21); `docs/whatsapp-oficial-overview.md` cita o módulo de regras (Regra 14)

**Achado fora do escopo, para decisão**: o nó "Esperar" grava a unidade em maiúsculas (`HOURS`) e o motor de modo agente compara em minúsculas (`run-workflow.ts`, `validate-node.ts`), o que daria espera de zero. Visto só na leitura do código, não reproduzido. Não é corrigido aqui.

## 10. Plano de testes

Sem runner instalado (Regra 20): script e verificação manual.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, 3, 4, 5, 6, 7, 8, 9 | script | `scripts/verify-workflow-simulator.ts`, com `node:assert` sobre desenhos de exemplo |
| CA-13 | script | Mesmo script, lendo os fluxos salvos do banco de desenvolvimento (somente leitura) |
| CA-2, 10, 11, 12 | manual | Navegador, aba de rede, nos 4 fluxos "Interesse em…" da Clínica Tércio Rezende |
| CA-14, 15 | script + manual | Ação chamada direto e pela conversa do ASTRO |

## 11. Riscos e rollback

- **Simulação diferente da execução real**: reduzido por D-1 (dizer o que não simula) e por CA-13.
- **Regra da API oficial desatualizada na tela**: um lugar só (D-3), com a data da conferência.
- **RF-23 piorar fluxos gerados**: a mudança é só no texto de instrução do gerador; desfazer é reverter o arquivo.
- **Rollback**: remover o botão "Simular" do editor desliga a função. Sem migration e sem dado gravado.

## 12. Fases

1. Interpretador puro e script de verificação.
2. Componentes do celular, da conversa e do card; painel e botão; leads de exemplo.
3. Leads reais, avisos por tipo de número, encadeamento por tag.
4. Painel "Problemas".
5. "Testar" do Fluxo de atendimento sobre os componentes compartilhados.
6. Ação do ASTRO e regras da API oficial na geração.

## 13. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-10 | Weydson | Criada, para revisão. Decisões já tomadas: painel ao lado do canvas; menu de botões na API oficial só como restrição; ASTRO cria e abre no simulador |
