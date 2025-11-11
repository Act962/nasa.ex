import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../auth";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ context, errors }) => {
    const { user, org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org?.id,
        participants: {
          some: {
            userId: user.id,
          },
        },
      },
    });
    return trackings;
  });

export const getTrackingWithStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List tracking with Status",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      tracking: z.object({
        id: z.string(),
        name: z.string(),
      }),
      status: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            color: z.string().nullable(),
            order: z.number(),
          })
        )
        .nullable(),
    })
  )
  .handler(async ({ context, input, errors }) => {
    const { user, org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
        organizationId: org.id,
        participants: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!tracking) {
      throw errors.BAD_REQUEST;
    }

    return {
      tracking: { id: tracking.id, name: tracking.name },
      status: tracking.status,
    };
  });

export const createTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { user, org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tracking = await prisma.tracking.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: org.id,
        participants: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    return {
      trackingName: tracking.name,
    };
  });

export const getTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      tracking: z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        organizationId: z.string(),
        description: z.string().nullable(),
      }),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!tracking) {
      throw errors.NOT_FOUND;
    }

    return {
      tracking: tracking,
    };
  });

export const deleteTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    const result = await prisma.tracking.delete({
      where: {
        id: input.trackingId,
      },
    });

    return {
      trackingName: result.name,
    };
  });

export const updateTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    const tracking = await prisma.tracking.update({
      where: {
        id: input.trackingId,
      },
      data: {
        name: input.name,
        description: input.description,
      },
    });

    return {
      trackingName: tracking.name,
    };
  });
