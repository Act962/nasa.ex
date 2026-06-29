-- Adiciona o NodeType WEB_SEARCH ao enum.
-- O executor (agent-executors/web-search.ts), a UI (node-components.ts,
-- node-options.ts) e o seed de Stars (web_search_executed) já existiam no
-- merge; faltava apenas o valor do enum no schema. Aditivo e idempotente.

ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'WEB_SEARCH';
