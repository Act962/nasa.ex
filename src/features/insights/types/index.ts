// Types based on the tracking dashboard API response

export interface BreakdownItem {
  name: string;
  count: number;
  leadIds: string[];
}

export interface DashboardSummary {
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  soldThisMonth: number;
  soldLastMonth: number;
  monthGrowthRate: number | null;
  totalConversations: number;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgTimeToFirstResponse: number | null;
}

export interface StatusData {
  status: {
    id: string;
    name: string;
    color: string | null;
  };
  count: number;
  leadIds: string[];
  breakdown?: BreakdownItem[];
}

export interface ChannelData {
  source: string;
  count: number;
  leadIds: string[];
  breakdown?: BreakdownItem[];
}

export interface AttendantData {
  responsible: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  isUnassigned: boolean;
  total: number;
  won: number;
  leadIds: string[];
  breakdown?: (BreakdownItem & { won: number })[];
}

export interface TagData {
  tag: {
    id: string;
    name: string;
    color: string | null;
  };
  count: number;
  leadIds: string[];
  breakdown?: BreakdownItem[];
}

export interface DashboardReport {
  summary: DashboardSummary;
  byStatus: StatusData[];
  byChannel: ChannelData[];
  byAttendant: AttendantData[];
  topTags: TagData[];
}

export type ChartType = "bar" | "pie" | "line" | "area" | "radial";

export interface DashboardSettings {
  visibleSections: {
    summary: boolean;
    byStatus: boolean;
    byChannel: boolean;
    byAttendant: boolean;
    topTags: boolean;
  };
  chartTypes: {
    byStatus: ChartType;
    byChannel: ChartType;
    byAttendant: ChartType;
    topTags: ChartType;
  };
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}
