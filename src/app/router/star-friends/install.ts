import { z } from "zod";
import prisma from "@/lib/prisma";
import { installApp } from "@/features/stars/lib/star-service";
import { STAR_FRIENDS_APP_SLUG } from "@/features/star-friends/lib/constants";
import { auditLoyaltyAction } from "@/features/star-friends/lib/audit";
import { userActor } from "@/features/star-friends/lib/actor";
import { starFriendsWith } from "./_base";

export const installStarFriends = starFriendsWith("canEdit")
  .input(z.object({}).optional())
  .handler(async ({ context, errors }) => {
    const organizationId = context.org.id;
    const result = await installApp(organizationId, STAR_FRIENDS_APP_SLUG);
    if (result.insufficientStars) {
      // installApp grava a instalação antes de debitar; sem saldo, desfaz.
      await prisma.workspaceIntegration.update({
        where: { organizationId_appSlug: { organizationId, appSlug: STAR_FRIENDS_APP_SLUG } },
        data: { isActive: false },
      });
      throw errors.BAD_REQUEST({ message: "Saldo de Stars insuficiente para ativar o STAR FRIENDS." });
    }
    await prisma.loyaltyProgram.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: "app.installed",
      actionLabel: "Instalou o STAR FRIENDS",
    });
    return { installed: true };
  });
