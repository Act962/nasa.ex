interface LogShape {
  appSlug: string;
  action?: string | null;
  featureKey?: string | null;
  subAppSlug?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, any> | null;
}

function metaStr(m: Record<string, any> | null | undefined, key: string): string | undefined {
  const v = m?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function buildResourceUrl(log: LogShape): string | null {
  const m = log.metadata ?? {};
  const fk = log.featureKey ?? "";
  const action = log.action ?? "";
  const id = log.resourceId ?? undefined;
  const trackingId = metaStr(m, "trackingId");
  const conversationId = metaStr(m, "conversationId");
  const leadId = metaStr(m, "leadId");
  const campaignId = metaStr(m, "campaignId");
  const workspaceId = metaStr(m, "workspaceId");
  const pageId = metaStr(m, "pageId");

  switch (log.appSlug) {
    case "tracking": {
      if (fk.startsWith("lead.") || action.startsWith("lead.")) {
        if (trackingId) return `/tracking/${trackingId}`;
      }
      if (fk.startsWith("status.") || fk.startsWith("tag.")) {
        if (trackingId) return `/tracking/${trackingId}/settings`;
      }
      if (fk.startsWith("tracking.") || action.startsWith("tracking.")) {
        if (id) return `/tracking/${id}`;
      }
      if (fk.startsWith("tracking.participant.") && trackingId) {
        return `/tracking/${trackingId}/settings`;
      }
      return null;
    }
    case "chat": {
      if (conversationId) return `/tracking-chat/${conversationId}`;
      if (trackingId) return `/tracking/${trackingId}/chat`;
      return null;
    }
    case "explorer":
    case "workspace": {
      const wid = workspaceId ?? id;
      if (wid) return `/workspaces/${wid}`;
      return null;
    }
    case "nasa-planner": {
      if (campaignId) return `/nasa-planner/campanhas/${campaignId}`;
      if (id && fk.includes("planner.")) return `/nasa-planner/${id}`;
      return "/nasa-planner";
    }
    case "nasa-route": {
      const courseId = metaStr(m, "courseId") ?? id;
      if (courseId && fk.includes("course.")) return `/nasa-route/cursos/${courseId}`;
      return "/nasa-route";
    }
    case "spacetime": {
      if (id && fk.includes("agenda.")) return `/agendas/${id}`;
      return "/agendas";
    }
    case "nbox": {
      return "/nbox";
    }
    case "linnker": {
      const pid = pageId ?? id;
      if (pid) return `/linnker/${pid}`;
      return "/linnker";
    }
    case "forms": {
      if (id) return `/form/${id}`;
      return "/form";
    }
    case "forge": {
      const proposalId = metaStr(m, "proposalId");
      if (proposalId) return `/forge/propostas/${proposalId}`;
      return "/forge";
    }
    case "payment":
    case "nasa-payment": {
      return "/payment";
    }
    case "nasa-partner":
    case "partner": {
      return "/apps/partner";
    }
    case "nasa-space-help":
    case "space-help":
    case "spacehelp": {
      const trackId = metaStr(m, "trackId");
      if (trackId) return `/space-help/trilhas/${trackId}`;
      return "/space-help";
    }
    case "space-station":
    case "station": {
      return "/space-station";
    }
    case "integrations": {
      return "/integrations";
    }
    case "permissions":
    case "settings":
      return "/settings";
    case "insights":
      return "/insights";
    default:
      return null;
  }
}
