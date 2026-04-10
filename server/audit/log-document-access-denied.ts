import { headers } from "next/headers";
import { logAuditEvent } from "./log-event";

type LogParams = {
  actorId: string | null;
  action: string;
  entityId: string | null;
  details?: Record<string, unknown>;
};

/**
 * Запись отказа в доступе. Ошибки БД глотаются, чтобы не ломать ответ пользователю.
 */
export async function logDocumentAccessDenied(params: LogParams): Promise<void> {
  const hdrs = await headers();
  await logAuditEvent({
    actorId: params.actorId,
    action: params.action,
    entityType: "Document",
    entityId: params.entityId,
    details: {
      reason: "POLICY",
      ...params.details,
    },
    ipAddress: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: hdrs.get("user-agent") ?? null,
  });
}
