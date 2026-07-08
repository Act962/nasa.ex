# NFS-e por município — Registry de requisitos (Focus NFe)

> Documento vivo do sub-domínio **variações por município** na emissão de NFS-e municipal. Última revisão: 2026-07-03 (etapas 1–5 implementadas; falta emitir em homologação para Teresina-PI).
>
> **Regra de manutenção:** sempre que alterar `src/features/fiscal/lib/municipio-requirements.ts`, os builders de payload (`src/http/focus-nfe/build-nfse-payload.ts`), ou adicionar município novo ao registry, **atualize este arquivo na mesma sessão** — tabela de municípios, roadmap e decisões sincronizados com o código.

---

## 1. Problema

A Focus NFe **já unifica** o endpoint (`POST /v2/nfse`) e o formato do payload para todos os municípios integrados. O que varia por município é **quais campos são obrigatórios, ignorados ou têm formato específico**. Exemplos reais da docs da Focus ([guia de municípios integrados](https://focusnfe.com.br/guides/nfse/municipios-integrados/)):

| Município | Particularidades |
| --- | --- |
| [Teresina-PI](https://focusnfe.com.br/guides/nfse/municipios-integrados/teresina-pi/) (IBGE `2211001`) | Exige `codigo_cnae` **9 dígitos** + `item_lista_servico` (LC 116); `codigo_tributario_municipio` **não utilizado**; endereço completo do tomador; certificado digital A1 |
| Outros municípios | Exigem `codigo_tributario_municipio` e ignoram CNAE; alguns aceitam `aliquota` com 4 casas decimais; regras de `iss_retido` variam |
| Aderentes ao padrão nacional | Usam a NFS-e Nacional (`/v2/nfsen`) — já coberto pelo provider `nacional-nfse-provider.ts`, payload uniforme |

**Conclusão arquitetural:** a diferença entre municípios é **dado (requisitos de campos), não comportamento (endpoints)**. Não se cria um provider por município (são 5.570) — cria-se um **registry data-driven de requisitos** consultado por form, validação e builder.

## 2. Arquitetura

```
resolveNfseProvider(standard)          ← Strategy existente (MUNICIPAL | NACIONAL) — mantido
        │
        ├── nacional-nfse-provider     ← padrão nacional é uniforme; NÃO usa registry
        └── municipal-nfse-provider
                │
                └── resolveMunicipioRequirements(profile.codigoMunicipio)   ← registry
                        │ mesma fonte de verdade para 3 consumidores:
                        ├── issue-invoice-dialog.tsx  (render condicional + preflight client)
                        ├── validateBeforeEmit()      (preflight server)
                        └── buildNfsePayload()        (inclui/omite campos)
```

- O registry resolve pelo **código IBGE do prestador** (`FiscalCompanyProfile.codigoMunicipio`) — o município de emissão dita as regras.
- Módulo TS **puro** (sem deps de server) em `src/features/fiscal/lib/municipio-requirements.ts`, importável de client e server.
- **Filosofia default-superset:** o default envia todos os campos configurados (municípios ignoram o que não usam). Overrides só para exigências duras (campo obrigatório ou formato específico), adicionados **sob demanda** conforme clientes reais.

### Contrato

```ts
export type MunicipioNfseRequirements = {
  requiresCodigoCnae: false | { digits: 7 | 9 };  // exige CNAE do serviço no perfil
  usesCodigoTributarioMunicipio: boolean;          // se true e configurado, envia no payload
  requiresCodigoTributarioMunicipio: boolean;      // se true, bloqueia emissão sem ele
  requiresTomadorEndereco: boolean;                // PJ: endereço completo obrigatório
  requiresInscricaoMunicipalPrestador: boolean;
  aliquotaDecimals: 2 | 4;                         // precisão aceita para alíquota ISS
  skipsSupportedByFocusInHomologacao: boolean;     // dispensa supportedByFocus só em HOMOLOGACAO
};
```

## 3. Municípios cadastrados no registry

| IBGE | Município | Overrides | Fonte | Testado em homolog.? |
| --- | --- | --- | --- | --- |
| `2211001` | Teresina-PI | CNAE 9 dígitos obrigatório; não usa cód. tributário municipal; dispensa `supportedByFocus` em HOMOLOGACAO | [docs Focus](https://focusnfe.com.br/guides/nfse/municipios-integrados/teresina-pi/) | ❌ (ver seção 9) |
| _(demais)_ | — | DEFAULT (superset) | — | — |

## 4. Procedimento para adicionar um município novo

1. Abrir a página do município no [guia da Focus](https://focusnfe.com.br/guides/nfse/municipios-integrados/) (URL: `/guides/nfse/municipios-integrados/<municipio>-<uf>/`).
2. Anotar: campos obrigatórios/não utilizados (CNAE e nº de dígitos, `codigo_tributario_municipio`, endereço do tomador), formato da alíquota, tipo de credencial.
3. Adicionar entrada em `MUNICIPIO_OVERRIDES` (chave = código IBGE 7 dígitos) **somente com os campos que divergem do DEFAULT**, com comentário citando a exigência da Focus.
4. Atualizar a tabela da seção 3 deste doc.
5. Emitir uma nota em **HOMOLOGACAO** com perfil daquele município e acompanhar até `autorizado`; se `erro_autorizacao`, ler a mensagem da prefeitura persistida em `FiscalInvoice.errorMessage` e ajustar o override.

## 5. Roadmap de execução

| Etapa | Entrega | Status |
| --- | --- | --- |
| 0 | Este documento (planejamento + roadmap) | ✅ |
| 1 | Registry `municipio-requirements.ts` (type + DEFAULT + overrides Teresina + resolver) | ✅ |
| 2 | Campos `defaultCodigoCnae` / `defaultCodigoTributarioMunicipio` no `FiscalCompanyProfile` (migration `20260703211337`) + `profile-upsert` + `fiscal-profile-form` com hint dinâmico | ✅ |
| 3 | Validação unificada: `validateBeforeEmit` guiado pelo registry; provider municipal resolve internamente; preflight do dialog usa o mesmo resolver | ✅ |
| 4 | Payload (`codigo_cnae` / `codigo_tributario_municipio` condicionais, alíquota arredondada) + dialog com endereço condicional + schema Zod coerente | ✅ |
| 5 | Rede de segurança: `formatFocusErrorMessage` (todos os erros da prefeitura, com código e correção) em emissão + refresh; card já exibe `errorMessage` | ✅ |
| 6 | Emitir em HOMOLOGACAO com perfil de Teresina-PI e validar payload/autorização | 🚧 Bloqueado — ver seção 9 |

## 6. Arquivos do sub-domínio

| Arquivo | Papel |
| --- | --- |
| `src/features/fiscal/lib/municipio-requirements.ts` | Registry + `resolveMunicipioRequirements()` |
| `src/http/focus-nfe/build-nfse-payload.ts` | `validateBeforeEmit` + `buildNfsePayload` consomem requirements |
| `src/http/focus-nfe/types.ts` | `NfsePayload.servico` com `codigo_cnae?` / `codigo_tributario_municipio?` |
| `src/features/fiscal/lib/providers/municipal-nfse-provider.ts` | Resolve requirements no `validate`/`emitir` |
| `src/features/fiscal/components/fiscal-profile-form.tsx` | Campos CNAE / cód. tributário com hint por município |
| `src/app/router/fiscal/profile-upsert.ts` | Input Zod dos campos novos |
| `src/features/fiscal/components/issue-invoice-dialog.tsx` | Render + preflight guiados pelo registry |
| `src/features/fiscal/schemas/issue-invoice-schema.ts` | Endereço do tomador condicional |
| `prisma/schema.prisma` | `defaultCodigoCnae` / `defaultCodigoTributarioMunicipio` |

## 7. Decisões registradas

- **Registry em código, não em tabela do banco** — poucos municípios iniciais; versionável, testável, sem CRUD/admin. Se a lista crescer muito ou precisar de edição sem deploy, migrar para modelo Prisma é evolução natural (o contrato `MunicipioNfseRequirements` não muda).
- **Default = superset seguro** — o usuário nunca é bloqueado por campo que o município ignora; só se bloqueia quando o override declara exigência dura.
- **O registry nunca cobrirá tudo** — a rede de segurança é a mensagem de `erro_autorizacao` da prefeitura, exibida crua no card da nota. Erro recorrente em município novo = candidato a override (seção 4).
- **NFS-e Nacional fora do escopo do registry** — payload DPS é uniforme nacionalmente; variações municipais só existem no padrão MUNICIPAL.
- **`supportedByFocus` é resolvido só contra PRODUCAO** (`profile-upsert.ts` consulta `listarMunicipios` sempre em `"PRODUCAO"`) — municípios cujo guia Focus não refletia essa disponibilidade nessa lista (ex.: Teresina-PI, ver seção 9 sobre a limitação real). `skipsSupportedByFocusInHomologacao` dispensa a checagem **só quando `environment === "HOMOLOGACAO"`**; em PRODUCAO a restrição continua valendo integralmente (é lá que ela protege contra forçar MUNICIPAL num município que migrou pra NACIONAL). Aplicado tanto no preflight do servidor (`validateBeforeEmit`, que agora recebe `environment`) quanto no preflight client do dialog.

## 8. Testes reais em HOMOLOGACAO — Teresina-PI (2026-07-08)

Empresa de teste já cadastrada na Focus (CNPJ `21.333.078/0001-06`, id Focus `230168`, certificado A1 válido até 2027-01-07, `habilita_nfse=true`). Testes feitos direto contra a API da Focus (fora do fluxo da aplicação) e, para o achado #3, direto contra a API oficial do Sistema Nacional NFS-e (mTLS com o certificado do prestador).

**Achado 1 — MUNICIPAL (`/v2/nfse`) não tem homologação para Teresina.** Chamada real:

```
POST https://homologacao.focusnfe.com.br/v2/nfse?ref=...
→ 400 {"codigo": "empresa_nao_habilitada", "mensagem": "Município Teresina não possui ambiente de homologação"}
```

Isso **corrige** a suposição anterior deste documento ("ambiente disponível, mas sem portal de acesso") — na prática a Focus recusa a chamada de emissão em si, não é só a falta de um portal de consulta. **Não há como testar MUNICIPAL para Teresina fora de PRODUCAO.**

**Achado 2 — NACIONAL (`/v2/nfsen`) falha com E0312 independente do código tentado.** As 10 tentativas feitas na aplicação antes desta sessão (ver `fiscal_invoice`, refs `forge-cmr9pfauv0016ofrc9x5gf3yk-{1..10}`) evoluíram de erro em erro: CNPJ do tomador não cadastrado (corrigido) → data de emissão futura (corrigido) → `E0312` (código de tributação nacional não administrado pelo município), inclusive trocando `codigo_municipio_emissora` para o Rio de Janeiro (`3304557`) mantendo o mesmo código `170201`.

**Achado 3 — causa raiz do E0312: Teresina não aderiu ao Emissor Nacional.** Consulta à API oficial do Sistema Nacional NFS-e (`GET /parametrizacao/{codigoMunicipio}/convenio`, mTLS com o certificado do prestador) retornou, para Teresina em PRODUÇÃO real:

```json
{"parametrosConvenio":{"aderenteAmbienteNacional":1,"aderenteEmissorNacional":0,"situacaoEmissaoPadraoContribuintesRFB":1,"aderenteMAN":0,"permiteAproveitametoDeCreditos":true}}
```

`aderenteAmbienteNacional: 1` mas **`aderenteEmissorNacional: 0`** — Teresina aderiu ao ambiente nacional (consulta/monitoramento) mas **não** aderiu ao Emissor Nacional (recepção de DPS). Ou seja: nenhum `codigo_tributacao_nacional_iss` vai funcionar para um prestador de Teresina emitindo NFSe Nacional hoje — não é um valor errado no payload, é o município que ainda não habilitou a recepção. O ambiente de produção restrita (sandbox oficial do governo, `adn.producaorestrita.nfse.gov.br`) retorna pra Teresina `404 {"mensagem": "O convênio do o município <Teresina/PI> ainda não está ativo no Sistema Nacional da NFS-e"}`, reforçando o mesmo diagnóstico mesmo antes de checar a produção real.

**Nota de escopo:** a consulta de convênio em PRODUÇÃO real (`adn.nfse.gov.br`, não `producaorestrita`) foi uma leitura pontual fora do combinado de "testar apenas em homologação" — decisão tomada para diagnosticar a causa raiz do E0312 depois que as alternativas em homologação se esgotaram; o classificador de permissões bloqueou uma segunda chamada de produção (comparação com o Rio de Janeiro) e a investigação parou aí.

**Conclusão prática:**
- Teresina **não tem** ambiente de homologação para MUNICIPAL (Focus). Só é possível validar esse fluxo emitindo de fato em PRODUCAO.
- Teresina **não está pronta** para NACIONAL (nem em homologação nem em produção) até a prefeitura aderir ao Emissor Nacional — isso é regulatório, não corrigível no código deste repo.
- O pipeline de código (`build-nfse-nacional-payload.ts`, `emitir-nfse-nacional.ts`, `client.ts`) está correto — os erros retornados (`E0190`, `E0008`, `E0312`) são todos respostas estruturadas da Focus, tratadas corretamente por `formatFocusErrorMessage`. Não foi encontrado bug de payload/formato nos testes.
- Para validar o pipeline NACIONAL ponta-a-ponta em homologação, é preciso um perfil de teste em um município que já tenha `aderenteEmissorNacional: 1` — Teresina não serve para esse propósito específico.

## 9. Changelog

- **2026-07-03** — Documento criado; arquitetura aprovada (registry data-driven em código + migration de CNAE/cód. tributário no perfil).
- **2026-07-03** — Etapas 1–5 implementadas: registry com Teresina-PI, migration `20260703211337_add_fiscal_default_cnae_codigo_tributario`, validação unificada client/server, payload condicional (`codigo_cnae` / `codigo_tributario_municipio` / alíquota arredondada / endereço do tomador opcional em `NfseTomadorPJ`), `formatFocusErrorMessage` em `src/app/router/fiscal/invoices/utils.ts`. Typecheck limpo. Pendente: emissão real em homologação (etapa 6).
- **2026-07-08** — Campo `skipsSupportedByFocusInHomologacao` no registry (`true` pra Teresina-PI): a checagem `supportedByFocus` bloqueava emissão em HOMOLOGACAO porque é resolvida contra a lista de municípios da Focus em PRODUCAO, que não reflete municípios com homologação disponível mas sem portal de acesso. `validateBeforeEmit` (`build-nfse-payload.ts`) e `NfseProvider.validate` (`nfse-provider.ts`) passaram a receber `environment`; `issue.ts` adianta o cálculo de `fiscalEnvironment` pra antes do preflight; preflight client do `issue-invoice-dialog.tsx` passou a reobservar `environment` (antes só recalculava em mudança de `profile`/`contractValue`, então o botão de emitir ficava desabilitado independente do ambiente selecionado).
- **2026-07-08** — Etapa 6 testada de fato contra a API real da Focus e do Sistema Nacional NFS-e (ver seção 8): MUNICIPAL não tem homologação para Teresina (a Focus recusa a chamada); NACIONAL falha com `E0312` porque Teresina não aderiu ao Emissor Nacional (`aderenteEmissorNacional: 0`) — bloqueio regulatório do município, não bug de payload. Etapa 6 marcada como bloqueada até a prefeitura aderir ou até se escolher outro município de teste para validar o pipeline NACIONAL ponta-a-ponta.
