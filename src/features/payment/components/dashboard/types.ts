export type PreviewEntry = {
  id: string;
  description: string;
  contactName: string | null;
  categoryName: string | null;
  amount: number;
  dueDate: Date | string;
  status: string;
};

export type RecentTransaction = {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  contactName: string | null;
  amount: number;
  occurredAt: Date | string;
};

export type DashboardTone = "emerald" | "red" | "blue" | "violet";

export const TONE_CLASSES: Record<
  DashboardTone,
  { value: string; iconWrap: string; dot: string }
> = {
  emerald: {
    value: "text-emerald-600 dark:text-emerald-400",
    iconWrap:
      "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  red: {
    value: "text-red-600 dark:text-red-400",
    iconWrap: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    dot: "bg-red-500",
  },
  blue: {
    value: "text-blue-600 dark:text-blue-400",
    iconWrap:
      "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  violet: {
    value: "text-violet-600 dark:text-violet-400",
    iconWrap:
      "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    dot: "bg-violet-500",
  },
};
