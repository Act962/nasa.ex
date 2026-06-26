# Fix — "Meu Sprite" não salva ao clicar em "Terminar → Salvar e sair"

**Reportado em:** 2026-06-10
**URL afetada:** `/station/<nick>/world` → Configurar Mundo → aba "Meu Sprite"
**Branch base:** `main`

## Sintoma

1. Usuário abre Configurar Mundo, vai na aba "Meu Sprite".
2. Arrasta uma imagem em "Arraste uma imagem aqui ou clique para selecionar".
3. Clica em "Fazer upload" → aparece "Sprite carregado! Clique em 'Terminar' para salvar".
4. Clica em "Terminar" → abre o popup "Salvar alterações?".
5. **Clica em qualquer botão e nada acontece visualmente** — não há toast de sucesso/erro, e ao reabrir o painel o sprite continua sendo o anterior.

## Onde está o bug

São 3 problemas combinados nas funções de save do `WorldSettingsPanel` + o hook `useUpdateWorld`. Cada um sozinho já é o bastante pra dar a sensação de "não salvou".

### Fix #1 — `handleSaveAvatar` não dá feedback

📄 [`src/features/space-station/components/world/world-settings-panel.tsx:282-298`](../src/features/space-station/components/world/world-settings-panel.tsx#L282)

Compare com `handleSave` (botão "💾 Salvar" do footer), que tem toasts:

```ts
// handleSave — TEM feedback ✅
onSuccess: () => { toast.success("Mundo salvo!"); onClose(); }
onError: (err) => { ...; toast.error(`Falha ao salvar: ${msg}`); }

// handleSaveAvatar (botão "Salvar e sair" do modal) — SEM feedback ❌
onSuccess: () => { markAvatarDirty(false); onDone?.(); }
onError: (err) => { setSaveError(...) }  // só seta erro no footer que o user nem vai ver, pois o painel já fechou
```

**O que fazer:** copiar a mesma lógica de toast pro `handleSaveAvatar`.

```ts
function handleSaveAvatar(onDone?: () => void) {
  setSaveError(null);
  updateWorld(
    { stationId, avatarConfig: avatar, mapData: buildMapData() },
    {
      onSuccess: () => {
        markAvatarDirty(false);
        toast.success("Avatar salvo!");           // ← adicionar
        onDone?.();
      },
      onError: (err) => {
        const msg = (err as { message?: string })?.message ?? "Erro ao salvar";
        setSaveError(msg);
        toast.error(`Falha ao salvar: ${msg}`);   // ← adicionar
      },
    },
  );
}
```

### Fix #2 — `handleSaveAvatar` não atualiza o Phaser

📄 Mesmo arquivo, mesmo bloco.

`handleSave` chama `applyPreview(newMapData)` ANTES de chamar `updateWorld` pra atualizar o canvas imediatamente. `handleSaveAvatar` **não chama**. Resultado: backend salva, frontend continua mostrando o sprite antigo até dar F5.

**O que fazer:** chamar `applyPreview` antes do `updateWorld`:

```ts
function handleSaveAvatar(onDone?: () => void) {
  setSaveError(null);
  // Atualiza o canvas do mundo imediatamente
  try { applyPreview(buildMapData(), avatar); }
  catch (e) { console.warn("[handleSaveAvatar] applyPreview failed:", e); }

  updateWorld(/* ... como acima ... */);
}
```

### Fix #3 — `useUpdateWorld` invalida a query errada

📄 [`src/features/space-station/hooks/use-station.ts:61-67`](../src/features/space-station/hooks/use-station.ts#L61)

```ts
export function useUpdateWorld() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.updateWorld.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(
      orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } })
    ),
  });
}
```

Invalida a **lista das minhas stations da org** — mas o `/station/<nick>/world` lê de outra query (a pública / por nick). Resultado: o cache do React Query mantém o `worldConfig` antigo, e ao reabrir o painel o avatar volta pro estado anterior.

**O que fazer:** invalidar TAMBÉM as queries que servem a página pública do mundo. Conferir com `grep` quais são (provavelmente `getStationByNick`, `getPublicStation`, ou `getStationWorld`) e invalidar todas:

```ts
export function useUpdateWorld() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.spaceStation.updateWorld.mutationOptions(),
    onSuccess: (_data, vars) => {
      // Listas
      qc.invalidateQueries(orpc.spaceStation.getMy.queryOptions({ input: { type: "ORG" } }));
      // Página pública do mundo — invalidar TODAS as queries do domínio spaceStation
      // relacionadas a essa stationId (mais simples e seguro).
      qc.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey as unknown[];
          return Array.isArray(key)
            && typeof key[0] === "string"
            && key[0].includes("spaceStation")
            && JSON.stringify(key).includes(vars.stationId);
        },
      });
    },
  });
}
```

Ou mais simples (com tradeoff de invalidar demais): `qc.invalidateQueries({ queryKey: ["spaceStation"] })`.

## Bônus — bugs relacionados que valem corrigir junto

### Bug #4 — `/api/upload-local` salva em filesystem efêmero em produção

📄 [`src/app/api/upload-local/route.ts:32-33`](../src/app/api/upload-local/route.ts#L32)

```ts
const uploadDir = join(process.cwd(), "public", "uploads");
await writeFile(join(uploadDir, filename), buffer);
```

Em Coolify o container Docker tem filesystem **efêmero por padrão**:
- Cada deploy zera o `/public/uploads`.
- Se houver autoscaling/restart, a réplica seguinte não tem o arquivo.
- Pior caso, `writeFile` falha com EROFS e devolve 500.

**O que fazer:** já existe `r2-url.ts` e `s3-client.ts` em `src/lib/`. Migrar esse endpoint pra subir pro R2/S3 igual ao resto do projeto (avatares, mídia de tracking, etc.). Como workaround temporário: montar um volume persistente no Coolify mapeado pra `/public/uploads` dentro do container.

### Bug #5 — Erros Zod do servidor não chegam legíveis no front

📄 [`src/app/router/space-station/update-world.ts:17-22`](../src/app/router/space-station/update-world.ts#L17)

O union de `lpcSpritesheetUrl` é OK, mas os overlays (`wokaEyesUrl` etc.) são `z.string().url().optional().nullable()`. Se em algum momento chega `""` (string vazia em vez de `null`), o Zod rejeita o objeto inteiro e o erro que aparece no front é genérico. Vale:

1. Auditar o `WokaCustomizer.selectOverlay` pra garantir que nunca grava `""`.
2. Trocar `z.string().url()` por `z.string().url().or(z.literal("")).transform(v => v || null)` ou similar pra ser tolerante.
3. Garantir que o handler oRPC propaga `errors.BAD_REQUEST` com a mensagem do Zod (não silenciar).

## Como reproduzir e validar a correção

1. `pnpm dev` local.
2. Logar como dono de uma station.
3. Ir em `/station/<nick>/world` → ⚙ Configurar Mundo → aba "Meu Sprite".
4. Subir um PNG, "Fazer upload", "Terminar".
5. No modal "Salvar alterações?", clicar **"Salvar e sair"**.
6. **Comportamento esperado depois do fix:**
   - Toast "Avatar salvo!" aparece.
   - Avatar no Phaser muda **imediatamente** pro novo sprite (sem F5).
   - Ao reabrir o painel, o sprite novo está marcado como selecionado.
7. **Em produção (após fix #4):** dar F5 ou abrir em outra aba → sprite continua lá (arquivo não some).

## Checklist pro dev

- [ ] Fix #1: toast no `handleSaveAvatar`
- [ ] Fix #2: `applyPreview` no `handleSaveAvatar`
- [ ] Fix #3: invalidação correta no `useUpdateWorld`
- [ ] Fix #4: migrar `upload-local` pra R2/S3
- [ ] Fix #5: tolerar `""` / propagar Zod errors
- [ ] Testar fluxo completo descrito acima
