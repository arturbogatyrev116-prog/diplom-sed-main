import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export type AuditLogEventInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAuditEvent(input: AuditLogEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        detailsJson: (input.details ?? ({} as Prisma.InputJsonValue)),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error instanceof Error ? error.message : String(error));
  }
}

