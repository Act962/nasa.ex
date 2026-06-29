import { Metadata } from "next";
import { DisputesPage } from "@/features/admin-calendar/components/disputes-page";

export const metadata: Metadata = {
  title: "Disputas do Calendário · Admin",
  robots: { index: false, follow: false },
};

export default function AdminCalendarDisputesPage() {
  return <DisputesPage />;
}
