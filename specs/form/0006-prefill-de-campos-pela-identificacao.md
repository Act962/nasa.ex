---
id: 0006
titulo: Pré-preencher campos do formulário com dados da identificação
dominio: form
status: rascunho
autor: João Gabriel
criada: 2026-08-17
atualizada: 2026-08-17
branch: feature/form-prefill-identificacao-20260817
pr:
peso: completa
---

# 0006 — Pré-preencher campos com dados da identificação

---

## 1. Contexto

Com `FormSettings.needLogin` ligado, o formulário abre num **step de
identificação** que coleta nome, e-mail e telefone (controlados por `showName`,
`showEmail`, `showPhone`). Esses valores viram `leadInfo` no cliente
(`use-lead-info.ts`) e são serializados na resposta como `user_name`,
`user_email` e `user_phone`.

O problema: se o formulário também tem um **campo de texto** pedindo "Nome do
cliente" ou "Telefone com DDD" — e tem, é o caso real relatado —, o usuário
digita a mesma informação **duas vezes**. A primeira no step de identificação, a
segunda no corpo do formulário. Não há nenhuma ligação entre os dois.

Hoje existe uma máquina de prefill (`form-prefill-context.tsx`), mas ela resolve
outro problema: alimenta blocos com o que **já foi respondido** numa resposta
existente, chaveado por `blockInstance.id`, e só é montada no fluxo de "continuar
preenchimento". Não tem relação com os campos da identificação.

## 2. Objetivo

Um bloco de entrada pode ser configurado para nascer preenchido com um dos
valores coletados no step de identificação, eliminando a digitação duplicada.

### Não-objetivos

- **Não** cria campos novos no step de identificação. A fonte continua sendo
  nome/e-mail/telefone.
- **Não** faz ligação de volta: editar o campo do corpo **não** altera o valor da
  identificação nem o lead.
- **Não** aplica a blocos que não sejam de entrada de texto simples (ver 6.1).
- **Não** substitui a máquina de prefill existente por `blockInstance.id` — as
  duas coexistem, com precedência definida em D-3.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Blocos elegíveis (6.1) ganham o atributo `prefillFromLead?: "name" \| "email" \| "phone" \| null` (ausente/`null` = desligado). |
| RF-2 | O painel de propriedades do bloco exibe um seletor "Preencher automaticamente com", seguindo o padrão de `UseAsResponseLabelToggle`. |
| RF-3 | Ao entrar no step de conteúdo, o bloco configurado nasce com o valor correspondente de `leadInfo`. |
| RF-4 | O valor pré-preenchido é **editável** — o usuário pode sobrescrever (D-2). |
| RF-5 | O valor pré-preenchido conta como preenchimento para validação de campo obrigatório e é gravado no `jsonResponse` como qualquer outro campo. |
| RF-6 | Se o usuário voltar ao step 1 e alterar a identificação, o campo vinculado **ainda não editado manualmente** reflete o novo valor; se já foi editado, mantém o que o usuário digitou (D-4). |
| RF-7 | O seletor só oferece opções cuja coleta esteja ativa nas configurações (`needLogin` + `showName`/`showEmail`/`showPhone`), e avisa quando não há nenhuma. |
| RF-8 | Telefone é inserido no mesmo formato exibido no step 1 (com máscara e DDI resolvido), não no formato normalizado do banco. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Zero requisição de rede: o vínculo é resolvido inteiramente no cliente, a partir de estado que já existe. |
| RNF-2 | Formulários existentes não mudam de comportamento — o atributo ausente é desligado. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um form com identificação exigida e um campo de texto com `prefillFromLead: "name"`, quando o usuário preenche "Maria" no step 1 e avança, então o campo aparece com "Maria".
- [ ] **CA-2** — Dado o mesmo cenário, quando o usuário edita o campo para "Maria Silva" e envia, então o `jsonResponse` grava "Maria Silva" e a identificação segue "Maria".
- [ ] **CA-3** — Dado um campo vinculado e **não** editado, quando o usuário volta ao step 1 e troca o nome, então o campo passa a refletir o novo nome.
- [ ] **CA-4** — Dado um campo vinculado **já editado manualmente**, quando o usuário volta e troca a identificação, então o campo mantém o texto digitado.
- [ ] **CA-5** — Dado um campo obrigatório vinculado e preenchido pelo prefill, quando o usuário envia sem tocar nele, então não há erro de validação.
- [ ] **CA-6** — Dado um form com `needLogin: false`, quando o construtor abre as propriedades do bloco, então o seletor aparece desabilitado com explicação.
- [ ] **CA-7** — Dado `showEmail: false`, quando o construtor abre o seletor, então "E-mail" não é oferecido.
- [ ] **CA-8** — Dado um campo vinculado a telefone, quando o prefill ocorre, então o valor exibido é o mascarado do step 1.
- [ ] **CA-9** — Dado um formulário existente sem o atributo, quando é preenchido, então o comportamento é idêntico ao de hoje.
- [ ] **CA-10** — Dado o fluxo de "continuar preenchimento" numa resposta que já tem valor salvo no bloco, quando a página abre, então prevalece o valor salvo, não o da identificação (D-3).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | `needLogin` desligado depois de já haver blocos vinculados | O vínculo é ignorado em runtime; campo nasce vazio. Sem erro. Aviso no builder. |
| CB-2 | Bloco vinculado a `email`, mas `showEmail` desligado depois | Idem CB-1 — a fonte não existe, campo nasce vazio. |
| CB-3 | Identificação preenchida por query string (`?name=`) ou retomada de sessão | Funciona igual: a fonte é `leadInfo`, independente de como chegou lá. |
| CB-4 | Fluxo de "continuar preenchimento" com valor já salvo no bloco | Valor salvo vence (D-3, CA-10). |
| CB-5 | Fluxo interno (`/formulario/novo/...`) onde o consultor preenche pelo lead | `initialLead` alimenta `leadInfo`; o vínculo funciona e traz os dados do lead. |
| CB-6 | Dois blocos vinculados à mesma fonte | Permitido — ambos recebem o valor. Não há razão para impedir. |
| CB-7 | Usuário limpa o campo vinculado deixando-o vazio | Conta como edição manual: não é re-preenchido (D-4). |
| CB-8 | Bloco vinculado dentro de um `RowLayout` (o caso normal do builder) | Funciona — o atributo é do bloco filho, atualizado por `updateChildBlock`. |
| CB-9 | Telefone sem DDI selecionado / país trocado após o prefill | O valor já inserido não muda sozinho; trocar o país no step 1 conta como alteração da fonte (CA-3). |

## 6. Decisões de design

### 6.1 Blocos elegíveis

Só blocos de **entrada de texto livre**, onde um nome/e-mail/telefone faz sentido:

| Bloco | Elegível | Observação |
| --- | --- | --- |
| `TextField` | ✅ | caso principal do pedido |
| `TextArea` | ✅ | mesmo tipo de valor |
| `MaskedField` | ✅ | destino natural do telefone |
| `Url` | ⬜ | fora do escopo — nenhuma fonte é URL |
| Demais (`Dropdown`, `RadioSelect`, `DatePicker`, `Slider`, uploads…) | ⬜ | valores de domínio fechado ou não-textuais |

### D-1 — Atributo do bloco, não configuração global

- **Escolha**: `prefillFromLead` vive nos `attributes` do bloco, como
  `useAsResponseLabel` já faz.
- **Alternativas descartadas**: um mapa em `FormSettings` do tipo
  `{ nameBlockId, emailBlockId }`. Descartada porque duplicaria a identidade do
  bloco em dois lugares e quebraria ao duplicar/remover blocos — o builder já
  sabe versionar `attributes`, não sabe reconciliar referências externas.

### D-2 — Valor pré-preenchido é editável, não travado

- **Escolha**: o campo nasce preenchido e aceita edição.
- **Motivo**: o caso real é "nome do cliente" — que pode ser diferente de quem
  preenche o formulário (secretária preenchendo pelo titular, por exemplo).
  Travar transformaria um atalho em restrição.
- **Alternativa descartada**: campo somente-leitura quando vinculado. Fica
  registrada como opção futura (um segundo atributo `lockWhenPrefilled`), não
  como padrão.

### D-3 — Valor salvo vence prefill de identificação

- **Escolha**: no fluxo de "continuar preenchimento", o `FormPrefillProvider`
  (por `blockInstance.id`) tem precedência sobre o vínculo com a identificação.
- **Motivo**: o valor salvo é uma resposta real já dada; sobrescrevê-la com o
  dado da identificação apagaria trabalho do usuário — e seria uma perda
  silenciosa, do tipo que ninguém percebe até o dado errado sair no PDF.
- **Consequência**: a ordem de resolução é **valor salvo → identificação →
  vazio**.

### D-4 — Rastrear "tocado" para decidir re-preenchimento

- **Escolha**: o bloco marca se o usuário já editou o campo. Enquanto não
  editou, acompanha a fonte; depois de editar, congela.
- **Alternativas descartadas**: (a) preencher só uma vez e nunca mais — quebra
  quem corrige um typo no nome no step 1 e volta; (b) sempre sobrescrever —
  destrói a edição manual a cada ida e volta entre steps.
- **Consequência**: campo esvaziado pelo usuário conta como tocado (CB-7).

### D-5 — Seletor reflete a configuração de identificação

- **Escolha**: o seletor no builder só lista fontes ativas e desabilita com
  explicação quando `needLogin` está desligado.
- **Motivo**: sem isso, o construtor configura um vínculo que silenciosamente
  nunca funciona — e vai debugar isso no formulário publicado, não no builder.

## 7. Impacto

- [ ] Schema / migration
- [ ] Procedures oRPC
- [ ] Realtime
- [ ] Automações
- [ ] Env vars novas
- [ ] Breaking change
- [ ] Documentação obrigatória

**Sem mudança de banco**: `attributes` do bloco já é JSON dentro de
`Form.jsonBlock`. Sem migration, sem contrato de procedure alterado.

**Arquivos previstos**:

| Arquivo | Mudança |
| --- | --- |
| `src/features/form/components/common/utils/prefill-from-lead-select.tsx` | novo — seletor no painel de propriedades |
| `src/features/form/components/common/blocks/text-field.tsx` | lê o atributo e resolve o valor |
| `src/features/form/components/common/blocks/text-area-block.tsx` | idem |
| `src/features/form/components/common/blocks/masked-field-block.tsx` | idem + formato do telefone (RF-8) |
| `src/features/form/context/form-prefill-context.tsx` | expõe os valores da identificação junto do mapa por bloco |
| `src/features/form/components/public/form-submit/form-submit-component.tsx` | injeta `leadInfo` no provider |

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2 | manual | Form com identificação + campo vinculado; preencher, avançar, editar, enviar e conferir `jsonResponse`. |
| CA-3, CA-4 | manual | Voltar ao step 1 e alterar o nome, com e sem edição prévia do campo. |
| CA-5 | manual | Campo obrigatório vinculado, enviar sem tocar. |
| CA-6, CA-7 | manual | Alternar `needLogin`/`showEmail` e reabrir o painel de propriedades. |
| CA-8 | manual | Vincular telefone e conferir máscara. |
| CA-9 | manual | Preencher um formulário legado sem o atributo. |
| CA-10 | manual | Abrir resposta existente pelo "continuar preenchimento" com valor divergente da identificação. |

> Cobertura automatizada segue a pendência registrada na spec 0005, seção 8.1 —
> entra com a remodelagem de arquitetura, não nesta feature.

## 9. Riscos e rollback

**Risco 1 — colisão silenciosa com o prefill existente.** É o risco real desta
feature: duas fontes disputando o mesmo campo. Mitigado por D-3 (ordem explícita)
e CA-10, que existe só para provar essa ordem.

**Risco 2 — vínculo órfão após mudança de configuração.** Desligar `needLogin`
deixa blocos apontando para fonte inexistente. Mitigado por CB-1/CB-2
(degradação silenciosa, campo vazio) e D-5 (aviso no builder).

**Rollback**: o atributo é aditivo dentro de `jsonBlock`. Revertendo o código,
blocos com `prefillFromLead` simplesmente ignoram o atributo e voltam a nascer
vazios. Nenhum dado é perdido.

## 10. Questões em aberto

| # | Questão | Recomendação |
| --- | --- | --- |
| Q-1 | O campo vinculado deve poder ser travado (somente leitura)? | **Não no v1** — ver D-2. Vira atributo próprio se for pedido. |
| Q-2 | `Url` e `Dropdown` entram como elegíveis? | **Não** — nenhuma fonte da identificação tem esse formato. |
| Q-3 | Deve haver indicação visual no formulário publicado de que o valor veio da identificação? | **Não no v1** — o valor é editável e igual a qualquer outro; um selo criaria ruído. |

## 11. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-17 | João Gabriel | Criada |
