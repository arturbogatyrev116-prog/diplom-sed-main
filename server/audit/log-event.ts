import { prisma } from "@/lib/db/prisma";

export type AuditLogEventInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details?: Record<string, unknown>;
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
        detailsJson: JSON.stringify(input.details ?? {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error instanceof Error ? error.message : String(error));
  }
}

