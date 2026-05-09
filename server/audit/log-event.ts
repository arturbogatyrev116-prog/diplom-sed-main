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

const DEDUP_ACTIONS = new Set(["DOCUMENT_VIEWED"]);
const DEDUP_WINDOW_MS = 60_000;

export async function logAuditEvent(input: AuditLogEventInput): Promise<void> {
  try {
    if (DEDUP_ACTIONS.has(input.action) && input.actorId && input.entityId) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS);
      const recent = await prisma.auditLog.findFirst({
        where: {
          action: input.action,
          actorId: input.actorId,
          entityId: input.entityId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (recent) return;
    }

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

