import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import z from "zod";

export const updateOrgLocation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/org-location",
    summary: "Update the active organization address and re-geocode it",
  })
  .input(
    z.object({
      addressLine: z.string().max(200).optional().nullable(),
      city:        z.string().max(100).optional().nullable(),
      state:       z.string().max(80).optional().nullable(),
      postalCode:  z.string().max(20).optional().nullable(),
      country:     z.string().max(60).optional().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.session.activeOrganizationId;
    if (!orgId) throw new Error("Organização ativa não definida");

    const member = await prisma.member.findUnique({
      where: { userId_organizationId: { userId: context.user.id, organizationId: orgId } },
      select: { role: true },
    });
    if (!member) throw new Error("Sem permissão");

    const parts = [input.addressLine, input.city, input.state, input.postalCode, input.country]
      .filter(Boolean)
      .join(", ");
    const geo = parts ? await geocodeAddress(parts) : null;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        addressLine: input.addressLine ?? null,
        city:        input.city ?? null,
        state:       input.state ?? null,
        postalCode:  input.postalCode ?? null,
        country:     input.country ?? "BR",
        latitude:    geo?.lat ?? null,
        longitude:   geo?.lng ?? null,
        geocodedAt:  geo ? new Date() : null,
      },
      select: {
        addressLine: true, city: true, state: true, postalCode: true, country: true,
        latitude: true, longitude: true, geocodedAt: true,
      },
    });
    return { ...updated, geocoded: !!geo };
  });
