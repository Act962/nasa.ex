"use client";
import { useEffect, useState } from "react";
import { countries } from "@/types/some";
import { phoneMask } from "@/utils/format-phone";

type LeadInfoState = {
  name: string;
  email: string;
  phone: string;
};

type UseLeadInfoParams = {
  initialLead?: { name?: string; email?: string; phone?: string };
};

export function useLeadInfo({ initialLead }: UseLeadInfoParams) {
  const [leadInfo, setLeadInfo] = useState<LeadInfoState>({
    name: initialLead?.name ?? "",
    email: initialLead?.email ?? "",
    phone: initialLead?.phone ?? "",
  });

  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  useEffect(() => {
    if (!initialLead) return;
    setLeadInfo((prev) => ({
      name: prev.name || (initialLead.name ?? ""),
      email: prev.email || (initialLead.email ?? ""),
      phone: prev.phone || (initialLead.phone ?? ""),
    }));
  }, [initialLead?.name, initialLead?.email, initialLead?.phone]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const qName = params.get("name");
      const qEmail = params.get("email");
      const qPhone = params.get("phone");
      if (!qName && !qEmail && !qPhone) return;
      setLeadInfo((prev) => ({
        name: prev.name || qName || "",
        email: prev.email || qEmail || "",
        phone: prev.phone || qPhone || "",
      }));
    } catch {
      // URL params inválidos não devem quebrar o formulário
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPhone = (rawValue: string) =>
    setLeadInfo((prev) => ({ ...prev, phone: phoneMask(rawValue) }));

  const setName = (value: string) =>
    setLeadInfo((prev) => ({ ...prev, name: value }));

  const setEmail = (value: string) =>
    setLeadInfo((prev) => ({ ...prev, email: value }));

  return {
    leadInfo,
    setLeadInfo,
    setName,
    setEmail,
    setPhone,
    selectedCountry,
    setSelectedCountry,
  };
}
