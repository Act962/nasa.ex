-- Seed das actions cobradas pelo Modo Agente IA em AppStarCost.
-- Admin pode editar os valores depois em /admin/stars > Regras.
-- ON CONFLICT é no-op — re-rodar é seguro.

INSERT INTO "app_star_costs" ("id", "app_slug", "monthly_cost", "display_name", "description", "category", "icon_emoji", "is_public", "created_at", "updated_at")
VALUES
  ('agent_act_decision', 'ai_decision_made', 1, 'Decisão da IA',
   'Astro escolhe próxima ramificação do agente IA com base no contexto do lead',
   'action', '🧭', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('agent_act_text', 'ai_text_generated', 1, 'Texto gerado pela IA',
   'Mensagem contextualizada gerada pelo agente IA (chama nome, varia tom)',
   'action', '✍️', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('agent_act_vision', 'ai_vision_analyzed', 3, 'Análise de imagem',
   'IA analisa imagem enviada pelo lead (comprovante, documento, foto)',
   'action', '👁️', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('agent_act_pdf', 'pdf_read', 2, 'Leitura de PDF',
   'IA extrai texto de PDF e interpreta o conteúdo',
   'action', '📄', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('agent_act_voice', 'send_voice_generated', 1, 'Voz gerada (TTS)',
   'Agente IA gera áudio com a voz natural do Astro e envia ao lead',
   'action', '🔊', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('agent_act_media', 'send_media_uploaded', 1, 'Mídia enviada',
   'Agente IA envia imagem, vídeo, áudio ou documento ao lead',
   'action', '📎', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("app_slug") DO NOTHING;
