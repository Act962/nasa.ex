# next_button_action — instruções para o dev aplicar

A coluna `form_settings.next_button_action` (Json) configura o que acontece
quando o usuário clica em "Próximo" no último grupo do form (modo manual).

Formato armazenado:
```json
{
  "type": "next_block" | "form" | "external_link" | "add_tag",
  "formId": "string | null",
  "externalUrl": "string | null",
  "tagId": "string | null",
  "passLeadData": true
}
```

Default: `{ "type": "next_block" }` — comportamento atual preservado.

## Aplicar a migração

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

Se preferir gerar com `migrate dev` (ambiente local), apague esta pasta antes
e rode:

```bash
pnpm prisma migrate dev --name form_settings_next_button_action
```

## Verificação rápida

```sql
SELECT id, next_button_action FROM form_settings LIMIT 1;
```

Deve retornar `{"type":"next_block"}` para registros já existentes.
