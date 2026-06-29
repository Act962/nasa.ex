// No-op para o pacote `server-only`. No Next ele vira no-op via a condition
// de export `react-server`; num processo Node puro (Fastify) ele lançaria erro.
// O router reusa módulos marcados com `import "server-only"` — aqui é seguro.
export {};
