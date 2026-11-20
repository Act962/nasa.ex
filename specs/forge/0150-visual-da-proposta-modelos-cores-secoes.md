---
id: 0150
titulo: Visual da proposta com modelos prontos, cores da empresa e ordem das seções
dominio: forge
status: implementada
autor: Weydson
criada: 2026-11-20
atualizada: 2026-11-20
branch: feature/W-star-friends-modo-pontos-20261109
pr: Act962/nasa.ex#502
peso: completa
---

# 0150 — Visual da proposta com modelos prontos, cores da empresa e ordem das seções

## 1. Contexto

A página pública da proposta (`/proposta/<token>`) é a mesma para todas as empresas: um único modelo (`TemplateModern` em `src/features/forge/components/public/proposal-templates.tsx`), escuro, sem a cor da marca do cliente. Nas configurações do Forge a empresa só escolhe cor de fundo e cor do texto (`proposalBgColor`, `typographyColor`), que quase não aparecem no modelo atual.

Problemas vistos no uso:

- A proposta não parece da empresa: sem a cor dela, sem destaque para o desconto, sem "quanto você economiza".
- Os cards de item mostram só a descrição do produto, não o nome (na proposta #0027 da GOTHAN CODEX aparece "[demo-insights] produto de demonstração" no lugar de "Gestão de Tráfego Pago — Mensal").
- Não há como a empresa escolher o que aparece nem em que ordem.
- O aceite já existe (`forge/accept-proposal.ts` e o botão "Aceitar e assinar proposta"), mas fica escondido no meio da página.

O Weydson mandou como referência uma proposta com faixa de marca no topo, faixa de dados (cliente, emissão, validade), itens com preço cheio riscado e selo "% OFF", totais com "Você economiza", formas de pagamento, condições e o bloco "Vamos fechar negócio?". O mock aprovado na conversa de 20/11/2026 segue essa referência com dados reais.

## 2. Objetivo

Cada empresa escolhe um modelo pronto, define a cor da marca e a ordem e a visibilidade das seções nas configurações do Forge, vê a prévia ao vivo e salva. Toda proposta pública passa a sair nesse visual, legível no celular.

### Não-objetivos

- Posicionamento livre de elementos na página (arrastar o preço para qualquer lugar). Quebra no celular e duplicaria o editor do Pages. Ver D-2.
- Visual diferente por proposta. A configuração é da empresa e vale para todas.
- Redesenho do editor de proposta em etapas (metade esquerda da referência). Fica para outra spec.
- Mudar o contrato, o recibo (spec 0148) ou o PDF do contrato.
- Fontes personalizadas.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Três modelos prontos: **Moderno** (o do mock: faixa de marca em diagonal, cartões arredondados), **Clássico** (cabeçalho reto, tabela de itens, visual de documento) e **Compacto** (uma coluna, sem imagens, para propostas curtas). Todos usam os mesmos dados e as mesmas seções. |
| RF-2 | Cores da empresa: **cor principal** (faixa do topo, título, total) e **cor de destaque** (botões e selos). O texto sobre cada cor fica claro ou escuro sozinho, pelo contraste. |
| RF-3 | Seções que a empresa pode **reordenar** (arrastar) e **ligar/desligar**: dados do cliente, descrição, itens, totais, formas de pagamento, condições comerciais, responsável, chamada para fechar negócio. O topo (marca e número) e o rodapé ficam fixos no começo e no fim. |
| RF-4 | Formas de pagamento aceitas, marcadas nas configurações: PIX, cartão de crédito (com "em até N vezes"), cartão de débito, boleto, transferência, dinheiro. Aparecem na seção "Formas de pagamento" com o texto opcional de cada uma. |
| RF-5 | Condições comerciais: texto padrão da empresa nas configurações. A descrição da própria proposta continua aparecendo na seção "Descrição". |
| RF-6 | Itens: nome do produto, descrição (da linha da proposta ou do produto), imagem quando houver, preço cheio riscado e selo "% OFF" quando a linha tiver desconto, preço final, quantidade e subtotal. |
| RF-7 | Totais: valor cheio, desconto total (itens + desconto da proposta), investimento total e "Você economiza R$ X (Y%)" quando houver desconto. Sem desconto, só o investimento total. |
| RF-8 | Chamada para fechar negócio: "Pagar com segurança" quando a proposta tem link de pagamento; "Aceitar proposta" quando não tem, usando a rota de aceite que já existe; "Falar no WhatsApp" com o telefone do responsável ou da empresa. Proposta paga, expirada ou cancelada não mostra esses botões. |
| RF-9 | Tela de configuração com prévia ao vivo de uma proposta de exemplo, com o nome e a logo da empresa. Computador: editor e prévia lado a lado. Celular: abas "Ajustar" e "Prévia". A prévia tem a chave "ver como celular". |
| RF-10 | Botão "Restaurar padrão" volta modelo, cores e seções ao padrão. |
| RF-11 | Empresa que nunca configurou vê o modelo Moderno com a cor principal atual da plataforma e todas as seções ligadas, na ordem do mock. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Sem tabela nova: colunas em `forge_settings` (ver D-3). |
| RNF-2 | Sem função ou cron novo no Inngest e sem variável de ambiente. |
| RNF-3 | Página pública responsiva a partir de 360 px de largura, sem rolagem lateral. O editor funciona em 390 px. |
| RNF-4 | A página pública não faz consulta a mais por causa do visual: as configurações já vêm na mesma busca de hoje. |
| RNF-5 | Contraste do texto sobre a cor principal e a de destaque de pelo menos 4,5:1 (WCAG AA). |

## 4. Critérios de aceite

- [ ] **CA-1** — Empresa sem configuração abre uma proposta e vê o modelo Moderno, com todas as seções, na ordem padrão.
- [ ] **CA-2** — Ao trocar modelo, cor ou ordem das seções, a prévia muda na hora; ao salvar e abrir uma proposta pública da empresa, ela sai igual à prévia.
- [ ] **CA-3** — Seção desligada não aparece na página pública nem no PDF da proposta.
- [ ] **CA-4** — Item com desconto mostra preço cheio riscado, selo "% OFF" com a porcentagem arredondada e o preço final; o total confere com a soma (ex.: #0002 Ace Chemicals: R$ 5.250,00 cheio, − R$ 210,00, total R$ 5.040,00, economia de 4%).
- [ ] **CA-5** — O card do item mostra o nome do produto, não só a descrição.
- [ ] **CA-6** — Proposta com link de pagamento mostra "Pagar com segurança"; sem link, mostra "Aceitar proposta" e o aceite gera o contrato como hoje; paga ou expirada não mostra nenhum dos dois.
- [ ] **CA-7** — Cor principal muito clara (ex.: amarelo) deixa o texto do topo escuro; cor escura deixa o texto claro.
- [ ] **CA-8** — Os três modelos, abertos em 360 px e 390 px, não rolam para o lado e mostram todos os valores sem corte.
- [ ] **CA-9** — Usuário de outra empresa não lê nem salva as configurações de visual de outra org passando ids.
- [ ] **CA-10** — "Restaurar padrão" volta ao estado do CA-1.

## 5. Casos de borda

- Lista de seções salva com seção que deixou de existir em versão futura: é ignorada. Seção nova que não está na lista salva: entra no fim, ligada.
- Todas as seções desligadas: a página mostra topo, itens e totais mesmo assim (itens e totais não podem ser desligados juntos; o editor impede desligar os dois).
- Cor inválida salva (texto que não é hex): usa a cor padrão.
- Empresa sem logo: o topo mostra o nome da empresa.
- Responsável e empresa sem telefone: o botão "Falar no WhatsApp" não aparece.
- Crédito marcado sem número de parcelas: aparece só "Cartão de crédito".
- Proposta com simulação (`breakdown`, recorrente e cobranças únicas): a seção de itens mostra as duas tabelas, como hoje, no estilo do modelo escolhido.
- Proposta antiga com `proposalBgColor` e `typographyColor` configurados: ver D-4.

## 6. Decisões de design

### D-1 — Modelos são componentes no código, não dados no banco
Três componentes React com as mesmas props. A empresa guarda só o id do modelo. Criar modelo pelo banco exigiria um motor de layout; com componentes, cada modelo é testado no celular antes de ir ao ar.

### D-2 — Ordem de seções em vez de posicionamento livre
Posição livre (x, y) quebra no celular e já existe no Pages. Ordem e visibilidade dão a liberdade que a empresa precisa (o que aparece e em que sequência) e funcionam em qualquer largura.

### D-3 — Onde guardar
Tudo em `forge_settings`, que já tem uma linha por empresa:
- `proposal_template` (texto, padrão `"modern"`): `modern`, `classic` ou `compact`.
- `brand_color` e `accent_color` (texto, hex, nulos = padrão da plataforma).
- `proposal_sections` (`Json`, nulo = padrão): lista ordenada `[{ id, enabled }]`. É configuração livre da própria empresa, lida inteira e nunca filtrada em consulta, que é o caso permitido para `Json` (S3).
- `payment_methods` (`Json`, nulo = nenhuma): lista `[{ method, installments?, note? }]`. Mesma justificativa: exibição, sem filtro nem soma.
- `commercial_terms` (texto, nulo).

Validação com Zod no servidor (enum de seções e de formas de pagamento, hex de cor, tamanho dos textos), para o `Json` não virar depósito de qualquer coisa.

### D-4 — O que fazer com `proposalBgColor` e `typographyColor`
Os três modelos novos não usam cor de fundo e cor de texto livres: elas brigam com a cor da marca e geram texto ilegível. Na migration, `brand_color` nasce copiando `proposal_bg_color` quando ela for diferente de branco. Os campos antigos saem da tela de configurações. As colunas antigas continuam usadas por `public-contract.tsx` e `public-proposal.tsx`; a remoção delas fica para quando o contrato também migrar (S9), registrada como dívida no PR.

### D-5 — Contraste calculado, não escolhido
O texto sobre a cor principal e a de destaque é calculado pela luminância (branco ou quase preto). Assim nenhuma combinação deixa o texto ilegível.

### D-6 — Aceite pela rota que já existe
"Aceitar e assinar proposta" reaproveita o botão e a rota que já existiam (`parts/accept-button.tsx` e `forge/accept-proposal.ts`), agora com a cor de destaque da empresa. Nada novo no servidor para isso.

## 7. Impacto

- **Schema:** 6 colunas opcionais em `forge_settings` (migration aditiva, com a cópia da D-4).
- **Procedures:** `forge.settings.get` e `forge.settings.update` ganham os campos novos.
- **Componentes:** `proposal-templates.tsx` (hoje com 394 linhas) vira uma pasta: seções compartilhadas (`sections/*.tsx`), um componente por modelo e o cálculo de totais e cores em `lib/`.
- **Configurações:** nova aba "Visual da proposta" em `forge-settings.tsx` (hoje com 698 linhas; a aba nova vai em componente próprio).
- **Guia do Astro:** âncora no botão "Salvar visual" e guia "personalizar a proposta" (Regra 21).
- **PDF da proposta:** usa a mesma página (impressão), então segue o modelo escolhido.

## 8. Plano de testes

Sem runner de teste no projeto (Regra 20). Verificação:
- Script em `scripts/` sobre o cálculo de totais e do selo de desconto, citando CA-4 (casos: sem desconto, desconto por item, desconto da proposta em % e em valor).
- Script sobre a normalização da lista de seções (seção removida, seção nova, todas desligadas), citando os casos de borda.
- Na tela, em dev: os três modelos em 360, 390 e 1440 px (CA-8), troca de cor clara e escura (CA-7), salvar e abrir a proposta pública (CA-2, CA-3), proposta com e sem link de pagamento, paga e expirada (CA-6).
- CA-9: chamar `forge.settings.update` com sessão de outra empresa.

## 9. Riscos e rollback

- **Todas as propostas mudam de visual no deploy.** Empresas que mandaram propostas recentes vão ver o modelo novo nos links já enviados. Aceitável: o conteúdo não muda, só a apresentação; o padrão (CA-1) foi desenhado para ser melhor que o atual para todos.
- **Cores antigas:** a cópia da D-4 preserva a cor de quem configurou fundo colorido; cor de texto antiga é descartada.
- **Rollback:** voltar o componente da página pública ao `TemplateModern`; as colunas novas são opcionais e podem ficar.

### Segurança

- Leitura e escrita das configurações só pela sessão da própria organização (`requireOrgMiddleware`), como hoje.
- A página pública continua acessível só pelo token da proposta. O visual não expõe dado novo: formas de pagamento e condições são textos que a própria empresa escreve para o cliente ver.
- Textos livres (condições, observação de pagamento) saem como texto puro, sem HTML, para não abrir injeção de script na página pública.
- Cores validadas como hex no servidor: nada de CSS arbitrário vindo do banco.

## 10. Changelog da spec

- 2026-11-20: criada, depois do mock aprovado na conversa (dados da proposta #0002) e da escolha do Weydson por modelos prontos, cores e ordem de seções em vez de posicionamento livre.
- 2026-11-20: implementada na PR Act962/nasa.ex#502. Mudanças em relação ao texto original:
  - **Prévia (RF-9):** dados de exemplo fixos com o nome e a logo da empresa, em vez da proposta mais recente. Evita uma consulta a mais e mostra todas as seções (com desconto, pagamento e condições) mesmo em empresa com propostas simples.
  - **Aceite:** já existia um botão de aceite na página; o texto da spec dizia que não. Reaproveitado.
  - **Causa do nome do produto sumido (CA-5):** o nome era escrito, mas herdava a cor clara do tema escuro do app e ficava branco sobre o card branco. Os modelos novos usam paleta própria, sem depender do tema.
  - **Consultas a menos:** a página pública buscava agenda, Space, Linnker e cursos da empresa para links que o modelo antigo nunca mostrava. Essas 4 consultas saíram, junto com os componentes sem uso (`company-info-block`, `ecosystem-links-block`, `identity-block` e o próprio `proposal-templates.tsx`).
  - **Celular:** o documento usa consultas de contêiner, não a largura da tela, para a prévia "ver como celular" ser igual ao celular de verdade.
  - **Cores (RNF-5):** além do texto sobre a cor, o texto colorido sobre fundo branco é escurecido até 4,5:1, para cor clara (amarelo) continuar legível.
  - Verificação em `scripts/forge-proposal-look-check.ts` (17 casos, CA-1, CA-4 e CA-7 e casos de borda).
