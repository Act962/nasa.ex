-- Seed da action web_search_executed em AppStarCost.
-- Faltava da seed anterior (estava marcada como Fase 6 quando essa migration
-- foi escrita). Admin pode editar valor depois em /admin/stars > Regras.

INSERT INTO "app_star_costs" ("id", "app_slug", "monthly_cost", "display_name", "description", "category", "icon_emoji", "is_public", "created_at", "updated_at")
VALUES
  ('agent_act_websearch', 'web_search_executed', 2, 'Busca na Web',
   'Agente IA pesquisa na web via Gemini Grounding ou OpenAI Search (preços, dados públicos, validações em tempo real)',
   'action', '🌐', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("app_slug") DO NOTHING;
