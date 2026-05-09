import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject } from "@/server/policies/document";
import { UserRole } from "@prisma/client";
import { logAuditEvent } from "@/server/audit/log-event";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(Object.values(UserRole));

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || subject.role !== UserRole.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (subject.userId === id) {
    return Response.json({ error: "Нельзя изменить собственный аккаунт" }, { status: 400 });
  }

  let body: { isActive?: boolean; role?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const data: { isActive?: boolean; role?: UserRole } = {};

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }
  if (typeof body.role === "string") {
    if (!ALLOWED_ROLES.has(body.role as UserRole)) {
      return Response.json({ error: "Недопустимая роль" }, { status: 400 });
    }
    data.role = body.role as UserRole;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Нет данных для обновления" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });

  await logAuditEvent({
    actorId: subject.userId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    details: data,
  });

  return Response.json({ ok: true, user });
}
