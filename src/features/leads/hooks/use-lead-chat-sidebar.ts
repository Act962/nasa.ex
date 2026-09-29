import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Consultas da lateral "Detalhes do Lead" do chat.

export function useLeadSidebarSummary(leadId: string) {
  return useQuery(orpc.leads.getChatSidebarSummary.queryOptions({ input: { leadId } }));
}

export function useLeadAppointments(leadId: string, enabled = true) {
  return useQuery({ ...orpc.leads.listLeadAppointments.queryOptions({ input: { leadId } }), enabled });
}

export function useLeadCampaigns(leadId: string, enabled = true) {
  return useQuery({ ...orpc.leads.listLeadCampaigns.queryOptions({ input: { leadId } }), enabled });
}

export function useLeadCommandRuns(leadId: string, enabled = true) {
  return useQuery({ ...orpc.leads.listLeadCommandRuns.queryOptions({ input: { leadId } }), enabled });
}

export function useLeadProposals(leadId: string, enabled = true) {
  return useQuery({ ...orpc.forge.proposals.list.queryOptions({ input: { clientId: leadId } }), enabled });
}
