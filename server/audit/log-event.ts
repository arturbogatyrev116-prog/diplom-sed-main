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

/**
 * Best-effort запись в AuditLog.
 * Ошибки намеренно глотаются, чтобы не ломать основной business-flow.
 */
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
  } catch {
    // intentionally empty
  }
}

