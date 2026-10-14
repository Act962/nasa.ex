# Triagem S5: procedures sem conferência de empresa

> Gerado por `scripts/arch/triage-tenancy-candidates.ts` a partir da baseline do job `arch`. Não edite à mão:
> rode o script de novo. Heurística por leitura do arquivo: serve para ordenar os lotes da etapa 8
> ([`migration-plan.md`](migration-plan.md)), e cada item ainda precisa de revisão antes de ganhar a trava.

## Alta: recebe id e escreve (51)

| Arquivo | Ids no input | Usa o usuário da sessão |
| --- | --- | --- |
| `src/app/router/alerts/acknowledge.ts` | `notificationId` | sim |
| `src/app/router/column/update-new-order.ts` | `beforeId`, `afterId`, `workspaceId` | não |
| `src/app/router/conversation/create.ts` | `trackingId` | sim |
| `src/app/router/conversation/start-by-phone.ts` | `trackingId` | sim |
| `src/app/router/ia/create-ai-button-preset.ts` | `tagId`, `trackingId` | sim |
| `src/app/router/ia/update-ai-button-preset.ts` | `tagId` | sim |
| `src/app/router/leads/add-historic-lead.ts` | `leadId`, `reasonId` | sim |
| `src/app/router/leads/add-lead-to-first.ts` | `leadId`, `statusId`, `trackingId` | sim |
| `src/app/router/leads/add-lead-to-last.ts` | `leadId`, `statusId`, `trackingId` | sim |
| `src/app/router/leads/update-whatsapp-labels.ts` | `tagIds` | sim |
| `src/app/router/message/mark-read.ts` | `conversationId` | não |
| `src/app/router/nasa-route/routes/creator-abort-video-upload.ts` | `uploadId` | sim |
| `src/app/router/nasa-route/routes/creator-delete-course.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/creator-delete-lesson.ts` | `courseId`, `lessonId` | sim |
| `src/app/router/nasa-route/routes/creator-delete-plan.ts` | `planId` | sim |
| `src/app/router/nasa-route/routes/creator-reorder-lessons.ts` | `courseId`, `moduleId` | sim |
| `src/app/router/nasa-route/routes/creator-reorder-modules.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/creator-set-plan-lessons.ts` | `planId`, `lessonIds` | sim |
| `src/app/router/nasa-route/routes/creator-upsert-lesson.ts` | `courseId`, `moduleId` | sim |
| `src/app/router/nasa-route/routes/creator-upsert-module.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/creator-upsert-plan-attachment.ts` | `planId` | sim |
| `src/app/router/nasa-route/routes/creator-upsert-plan.ts` | `courseId` | sim |
| `src/app/router/plans/create-plan-checkout.ts` | `planId`, `paymentId` | não |
| `src/app/router/profile-card/add-skill.ts` | `skillId` | sim |
| `src/app/router/profile-card/add-tool.ts` | `toolId` | sim |
| `src/app/router/profile-card/remove-skill.ts` | `skillId` | sim |
| `src/app/router/profile-card/remove-tool.ts` | `toolId` | sim |
| `src/app/router/reasons/create.ts` | `trackingId`, `reasonId` | não |
| `src/app/router/reasons/update.ts` | `reasonId` | não |
| `src/app/router/reminder/delete.ts` | `reminderId` | sim |
| `src/app/router/rodizio/create.ts` | `userIds`, `trackingId` | não |
| `src/app/router/rodizio/finish-lead.ts` | `trackingId`, `leadId` | não |
| `src/app/router/rodizio/new-lead.ts` | `leadId` | sim |
| `src/app/router/scripts/create.ts` | `trackingId` | não |
| `src/app/router/space-help/routes/set-step-screenshot.ts` | `stepId` | sim |
| `src/app/router/space-help/routes/upsert-category.ts` | `appId` | sim |
| `src/app/router/space-help/routes/upsert-feature.ts` | `categoryId` | sim |
| `src/app/router/space-help/routes/upsert-lesson.ts` | `trackId` | sim |
| `src/app/router/space-help/routes/upsert-step.ts` | `featureId` | sim |
| `src/app/router/space-help/routes/upsert-track.ts` | `categoryId`, `rewardBadgeId` | sim |
| `src/app/router/space-station/create-user-connection.ts` | `connectedUserId` | sim |
| `src/app/router/space-station/delete-world-template.ts` | `templateId` | sim |
| `src/app/router/space-station/get-world-template.ts` | `templateId` | sim |
| `src/app/router/status/update.ts` | `statusId`, `trackingId` | não |
| `src/app/router/support/create.ts` | `appId` | sim |
| `src/app/router/tags/update.ts` | `tagId`, `tagGroupId` | não |
| `src/app/router/trackings/update-idle-automation.ts` | `trackingId` | não |
| `src/app/router/workflow-folder/create.ts` | `trackingId` | sim |
| `src/app/router/workflow-folder/move-workflow.ts` | `workflowId`, `folderId` | sim |
| `src/app/router/workspace-workflow/update-is-active.ts` | `workflowId` | não |
| `src/app/router/workspace-workflow/update.ts` | `workflowId`, `workspaceId` | não |

## Média: recebe id e lê (55)

| Arquivo | Ids no input | Usa o usuário da sessão |
| --- | --- | --- |
| `src/app/router/column/list-simple.ts` | `workspaceId` | não |
| `src/app/router/conversation/find-by-phone.ts` | `trackingId` | não |
| `src/app/router/conversation/find-chats.ts` | `trackingId` | não |
| `src/app/router/conversation/list.ts` | `trackingId`, `statusId`, `cursorId`, `tagIds` | não |
| `src/app/router/ia/list-ai-button-presets.ts` | `trackingId` | sim |
| `src/app/router/integrations/list.ts` | `trackingId` | não |
| `src/app/router/leads/export-leads.ts` | `trackingId`, `statusId` | não |
| `src/app/router/leads/get-many.ts` | `statusId`, `trackingId`, `cursorId` | não |
| `src/app/router/leads/journey/get.ts` | `leadId` | não |
| `src/app/router/leads/list-all-attachments.ts` | `leadId` | não |
| `src/app/router/leads/list-files.ts` | `leadId` | não |
| `src/app/router/leads/list-historic.ts` | `leadId` | não |
| `src/app/router/message/customer-window.ts` | `conversationId` | não |
| `src/app/router/message/list.ts` | `conversationId` | não |
| `src/app/router/message/sync-from-uazapi.ts` | `conversationIds` | sim |
| `src/app/router/nasa-planner/get-post.ts` | `postId` | sim |
| `src/app/router/nasa-planner/v2/approval.ts` | `postId`, `reviewerId`, `slideId` | sim |
| `src/app/router/nasa-planner/v2/post-comments.ts` | `postId`, `commentId` | sim |
| `src/app/router/nasa-planner/v2/publish-group.ts` | `postId`, `instagramAccountIds` | sim |
| `src/app/router/nasa-route/routes/creator-get-course.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/creator-get-upload-part-url.ts` | `uploadId` | sim |
| `src/app/router/nasa-route/routes/creator-list-plans.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/creator-report-upload-part.ts` | `uploadId` | sim |
| `src/app/router/nasa-route/routes/creator-send-test-purchase-email.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/get-community-invite.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/get-course-as-student.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/get-ebook-download-url.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/get-event-stream-url.ts` | `courseId` | sim |
| `src/app/router/nasa-route/routes/get-subscription-status.ts` | `courseId` | sim |
| `src/app/router/reasons/list.ts` | `trackingId` | não |
| `src/app/router/reminder/list-occurrences.ts` | `reminderId` | não |
| `src/app/router/reminder/list.ts` | `conversationId`, `leadId`, `trackingId`, `actionId` | não |
| `src/app/router/rodizio/list-users-without-consultants.ts` | `trackingId` | não |
| `src/app/router/rodizio/list.ts` | `trackingId` | não |
| `src/app/router/scripts/list.ts` | `trackingId` | não |
| `src/app/router/space-station/poke-peer.ts` | `stationId`, `toUserId` | sim |
| `src/app/router/stars/list-plans.ts` | `ctaGatewayId` | não |
| `src/app/router/status/get-many.ts` | `trackingId` | não |
| `src/app/router/status/get-referenced-workflows.ts` | `statusId`, `workflowId`, `trackingId` | não |
| `src/app/router/tags/get-referenced-workflows.ts` | `tagId`, `workflowId`, `trackingId` | não |
| `src/app/router/tags/get-tag-by-lead.ts` | `leadId` | não |
| `src/app/router/trackings/get-card-config.ts` | `trackingId` | não |
| `src/app/router/trackings/get-idle-automation.ts` | `trackingId` | não |
| `src/app/router/trackings/list-participants.ts` | `trackingId` | não |
| `src/app/router/workflow-folder/list.ts` | `trackingId` | sim |
| `src/app/router/workflow/dry-run.ts` | `workflowId`, `runId`, `nodeId` | sim |
| `src/app/router/workflow/get.ts` | `workflowId` | sim |
| `src/app/router/workflow/list-runs.ts` | `workflowId`, `runId` | sim |
| `src/app/router/workflow/step-node.ts` | `statusId`, `trackingId`, `responsibleId`, `workflowId`, `nodeId` | sim |
| `src/app/router/workflow/validate.ts` | `workflowId` | sim |
| `src/app/router/workspace-workflow/execute.ts` | `actionId` | não |
| `src/app/router/workspace-workflow/get.ts` | `workflowId` | não |
| `src/app/router/world-events/list-events.ts` | `stationId` | não |
| `src/app/router/world-events/my-tickets.ts` | `ticketId` | sim |
| `src/features/astro/server/routes/model-pricing.ts` | `platformModelIds` | sim |

## Baixa: não recebe id de recurso (provável escopo por usuário) (67)

| Arquivo | Ids no input | Usa o usuário da sessão |
| --- | --- | --- |
| `src/app/router/alerts/catalog.ts` | — | não |
| `src/app/router/brand/search-google-fonts.ts` | — | não |
| `src/app/router/form/get-many-responses.ts` | — | não |
| `src/app/router/form/status.ts` | — | sim |
| `src/app/router/ia/delete-ai-button-preset.ts` | — | sim |
| `src/app/router/insights/list-my-organizations.ts` | — | sim |
| `src/app/router/nasa-route/routes/creator-delete-plan-attachment.ts` | — | sim |
| `src/app/router/nasa-route/routes/list-my-certificates.ts` | — | sim |
| `src/app/router/nasa-route/routes/list-my-enrollments.ts` | — | sim |
| `src/app/router/pages/domain-search.ts` | — | não |
| `src/app/router/pages/get-edge-config.ts` | — | não |
| `src/app/router/profile-card/get-my-profile-card.ts` | — | sim |
| `src/app/router/profile-card/list-role-consent-requests.ts` | — | sim |
| `src/app/router/profile-card/upsert-profile-card.ts` | — | sim |
| `src/app/router/public/calendar/quick-create-from-link.ts` | — | sim |
| `src/app/router/public/space/send-star.ts` | — | não |
| `src/app/router/push/list-mine.ts` | — | sim |
| `src/app/router/push/subscribe.ts` | — | sim |
| `src/app/router/push/unsubscribe.ts` | — | sim |
| `src/app/router/reasons/delete.ts` | — | não |
| `src/app/router/rodizio/delete.ts` | — | não |
| `src/app/router/rodizio/update.ts` | — | não |
| `src/app/router/scripts/delete.ts` | — | não |
| `src/app/router/scripts/update.ts` | — | não |
| `src/app/router/space-help/routes/admin-get-category.ts` | — | sim |
| `src/app/router/space-help/routes/admin-get-feature.ts` | — | sim |
| `src/app/router/space-help/routes/admin-get-track.ts` | — | sim |
| `src/app/router/space-help/routes/admin-list-badges.ts` | — | sim |
| `src/app/router/space-help/routes/admin-list-categories.ts` | — | sim |
| `src/app/router/space-help/routes/admin-list-tracks.ts` | — | sim |
| `src/app/router/space-help/routes/admin-stats.ts` | — | sim |
| `src/app/router/space-help/routes/check-moderator.ts` | — | sim |
| `src/app/router/space-help/routes/delete-badge.ts` | — | sim |
| `src/app/router/space-help/routes/delete-category.ts` | — | sim |
| `src/app/router/space-help/routes/delete-feature.ts` | — | sim |
| `src/app/router/space-help/routes/delete-lesson.ts` | — | sim |
| `src/app/router/space-help/routes/delete-step.ts` | — | sim |
| `src/app/router/space-help/routes/delete-track.ts` | — | sim |
| `src/app/router/space-help/routes/get-feature.ts` | — | não |
| `src/app/router/space-help/routes/list-badges.ts` | — | não |
| `src/app/router/space-help/routes/list-categories.ts` | — | não |
| `src/app/router/space-help/routes/list-tracks.ts` | — | sim |
| `src/app/router/space-help/routes/list-user-badges.ts` | — | sim |
| `src/app/router/space-help/routes/set-youtube-url.ts` | — | sim |
| `src/app/router/space-help/routes/upsert-badge.ts` | — | sim |
| `src/app/router/space-station/list-my-connections.ts` | — | sim |
| `src/app/router/space-station/list-my-world-templates.ts` | — | sim |
| `src/app/router/space-station/publish-avatar-template.ts` | — | sim |
| `src/app/router/stars/get-app-cost.ts` | — | não |
| `src/app/router/stars/get-stars-pricing.ts` | — | não |
| `src/app/router/stars/list-action-costs.ts` | — | não |
| `src/app/router/stars/list-active-gateways.ts` | — | não |
| `src/app/router/stars/list-packages.ts` | — | não |
| `src/app/router/status/update-new-order.ts` | — | não |
| `src/app/router/support/list.ts` | — | não |
| `src/app/router/support/update.ts` | — | não |
| `src/app/router/tag-groups/delete.ts` | — | não |
| `src/app/router/tag-groups/update.ts` | — | não |
| `src/app/router/tracking-presets/get-detail.ts` | — | não |
| `src/app/router/tracking-presets/list.ts` | — | não |
| `src/app/router/user-chat-preferences/get.ts` | — | sim |
| `src/app/router/user-chat-preferences/update.ts` | — | sim |
| `src/app/router/user/index.ts` | — | não |
| `src/app/router/workflow-folder/delete.ts` | — | sim |
| `src/app/router/workflow-folder/update.ts` | — | sim |
| `src/app/router/workflow/execute.ts` | — | sim |
| `src/app/router/workspace-workflow/delete.ts` | — | não |
