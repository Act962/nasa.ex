// Spec 0135, D-8: o better-auth grava `null` em lista opcional e o Prisma não aceita; aqui o `null` some na escrita e `[]` volta a `null` na leitura (só nos campos OAuth). Proxy, não `$extends`, pela regra 22; não usar este cliente em `$transaction([...])`.

const OPTIONAL_LIST_FIELDS_BY_DELEGATE: Record<string, readonly string[]> = {
  oauthClient: ["scopes", "clientCredentialsScopes", "contacts", "postLogoutRedirectUris", "grantTypes", "responseTypes"],
  oauthResource: ["allowedScopes"],
  oauthRefreshToken: ["resources", "requestedUserInfoClaims"],
  oauthAccessToken: ["resources", "requestedUserInfoClaims"],
  oauthConsent: ["resources", "requestedUserInfoClaims"],
};

const WRITE_METHODS = new Set(["create", "createMany", "update", "updateMany", "upsert"]);
const ROW_RETURNING_METHODS = new Set(["create", "update", "upsert", "delete", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "findMany"]);

type UnknownRecord = Record<string, unknown>;
type DelegateMethod = (args?: UnknownRecord) => Promise<unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);

function withoutNullLists(data: unknown, fields: readonly string[]): unknown {
  if (Array.isArray(data)) return data.map((item) => withoutNullLists(item, fields));
  if (!isRecord(data)) return data;
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => !(value === null && fields.includes(key))));
}

function sanitizeWriteArgs(args: UnknownRecord | undefined, fields: readonly string[]): UnknownRecord | undefined {
  if (!args) return args;
  const sanitized: UnknownRecord = { ...args };
  for (const key of ["data", "create", "update"]) {
    if (key in sanitized) sanitized[key] = withoutNullLists(sanitized[key], fields);
  }
  return sanitized;
}

function restoreNullLists(result: unknown, fields: readonly string[]): unknown {
  if (Array.isArray(result)) return result.map((row) => restoreNullLists(row, fields));
  if (!isRecord(result)) return result;
  const restored: UnknownRecord = { ...result };
  for (const field of fields) {
    if (Array.isArray(restored[field]) && (restored[field] as unknown[]).length === 0) restored[field] = null;
  }
  return restored;
}

function wrapDelegate(delegate: object, fields: readonly string[]): object {
  return new Proxy(delegate, {
    get(target, property, receiver) {
      const member: unknown = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof member !== "function") return member;
      const method = member as DelegateMethod;
      return async (args?: UnknownRecord) => {
        const result = await method.call(target, WRITE_METHODS.has(property) ? sanitizeWriteArgs(args, fields) : args);
        return ROW_RETURNING_METHODS.has(property) ? restoreNullLists(result, fields) : result;
      };
    },
  });
}

/** Cliente do Prisma que o better-auth recebe: igual ao global, com a ponte nos delegates OAuth. */
export function withOAuthNullableLists<Client extends object>(client: Client): Client {
  const wrappedDelegates = new Map<string, object>();
  return new Proxy(client, {
    get(target, property, receiver) {
      const member: unknown = Reflect.get(target, property, receiver);
      if (typeof property !== "string") return member;
      const fields = OPTIONAL_LIST_FIELDS_BY_DELEGATE[property];
      if (fields && typeof member === "object" && member !== null) {
        if (!wrappedDelegates.has(property)) wrappedDelegates.set(property, wrapDelegate(member, fields));
        return wrappedDelegates.get(property);
      }
      // Transação interativa do adapter: o `tx` também precisa da ponte.
      if (property === "$transaction" && typeof member === "function") {
        return (operation: unknown, ...rest: unknown[]) =>
          typeof operation === "function"
            ? member.call(target, (transactionClient: object) => operation(withOAuthNullableLists(transactionClient)), ...rest)
            : member.call(target, operation, ...rest);
      }
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}
