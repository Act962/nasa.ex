# Permissões por app (Configurações → Permissões)

**Catálogo da matriz:** fica em `src/features/permissions/lib/app-permission-catalog.ts` (`ALL_APPS`), a mesma fonte para cliente e servidor. Cada app pode ter `actionHints`, a dica do que cada ação libera.

## Como a regra é aplicada
| Onde | Como |
| --- | --- |
| Procedure única | `.use(requireAppPermission(appKey, action))`, em `src/app/middlewares/app-permission.ts` |
| Router inteiro | `base.use(appRouterPermission(appKey)).router(router)`, em `src/app/middlewares/app-router-permission.ts` |
| Rota HTTP ou lógica solta | `hasAppPermission(orgId, userId, appKey, action)` |
| Cliente (só esconde botões) | `useCheckPermission()` |

**Ação deduzida no guarda por router:** vem do nome da procedure (`resolveProcedureAction`):

| Nome começa com | Ação |
| --- | --- |
| `list` / `get` / `search` … | Ver |
| `create` / `add` / `send` … | Criar |
| `delete` / `remove` / `disconnect` … | Excluir |
| qualquer outro | Editar |

Paths com `public` ou listados em `skipPathSegments` não passam pelo guarda.

## Apps protegidos por router
| Chave | Router | Observação |
| --- | --- | --- |
| `nerp` | `nerp` | A conexão e a configuração do catálogo usam a chave `catalogo-online` |
| `comments` | `commentsApp` | |
| `nasa-pages` | `pages` | `registerVisit` e `public*` ficam livres |
| `astro` | `astro` | O chat HTTP `/api/astro/chat` exige Ver |
| `space-station` | `spaceStation` | |

**Padrão sem configuração:** esses 5 apps começam **liberados para todos os papéis** (`PREVIOUSLY_UNRESTRICTED_APPS`), porque não tinham restrição antes. Os demais apps seguem `DEFAULT_PERMISSIONS` por papel. O Master sempre tem tudo.

## Ações especiais
Definidas em `EXTENDED_ACTIONS_BY_APP`: Financeiro (Aprovar, Pagar) e STAR FRIENDS (Aprovar).
