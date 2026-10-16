## O que muda

<!-- Uma ou duas frases. -->

## Checklist

- [ ] Mudança relevante tem spec em `specs/` e cada `CA-n` tem teste com o id no nome
- [ ] Código novo com regra de negócio (invariante, dinheiro, auth, dados de lead) nasceu em `src/modules/`, não dentro de um handler
- [ ] `pnpm test` e `pnpm arch` passam
- [ ] Se `pnpm arch:features` acusou melhoria, a baseline foi regravada (`pnpm arch:features --update`)
- [ ] Baseline de fronteiras não foi afrouxada; se foi, o motivo está descrito acima
