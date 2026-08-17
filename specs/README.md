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

---

## Integração com o CLAUDE.md

O CLAUDE.md é a fonte de verdade das regras do projeto, e o SDD já está lá:
**item 17**, que aponta para este arquivo. Mudou o fluxo aqui? Confira se o item
17 continua descrevendo a mesma coisa.
