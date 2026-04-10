import { prisma } from "@/lib/db/prisma";

export async function listLatestAuditEvents(limit = 30) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      detailsJson: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });
}

