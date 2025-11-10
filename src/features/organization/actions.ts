"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export default async function setOrganization({
  organizationId,
  organizationSlug,
}: {
  organizationId: string;
  organizationSlug: string;
}) {
  try {
    const data = await auth.api.setActiveOrganization({
      body: {
        organizationId: organizationId,
        organizationSlug: organizationSlug,
      },
    });

    revalidatePath("/");
  } catch (error) {
    console.log(error);
    return {
      error: "Erro ao definir organização",
    };
  }
}
