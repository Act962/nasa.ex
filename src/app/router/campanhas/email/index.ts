import { archiveEmailTemplate, listEmailTemplates, saveEmailTemplate, sendTestEmail } from "./templates";
import { createEmailCampaign, emailAudienceSummary, listEmailCampaigns } from "./campaigns";

export const campanhasEmailRouter = {
  listTemplates: listEmailTemplates,
  saveTemplate: saveEmailTemplate,
  archiveTemplate: archiveEmailTemplate,
  sendTest: sendTestEmail,
  audienceSummary: emailAudienceSummary,
  createCampaign: createEmailCampaign,
  listCampaigns: listEmailCampaigns,
};
