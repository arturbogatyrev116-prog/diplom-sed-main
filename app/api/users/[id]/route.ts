import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject } from "@/server/policies/document";
import { UserRole } from "@prisma/client";
import { logAuditEvent } from "@/server/audit/log-event";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(Object.values(UserRole));

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || subject.role !== UserRole.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (subject.userId === id) {
    return Response.json({ error: "Нельзя удалить собственный аккаунт" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, email: true } });
  if (!user) {
    return Response.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const fullName = user.fullName;

    await tx.document.updateMany({ where: { authorId: id }, data: { authorName: fullName } });
    await tx.documentVersion.updateMany({ where: { createdById: id }, data: { createdByName: fullName } });
    await tx.comment.updateMany({ where: { authorId: id }, data: { authorName: fullName } });
    await tx.attachment.updateMany({ where: { uploadedById: id }, data: { uploadedByName: fullName } });
    await tx.signature.updateMany({ where: { signedById: id }, data: { signedByName: fullName } });
    await tx.approvalStep.updateMany({ where: { approverId: id }, data: { approverName: fullName } });
    await tx.auditLog.updateMany({ where: { actorId: id }, data: { actorName: fullName } });

    await tx.user.delete({ where: { id } });
  });

  await logAuditEvent({
    actorId: subject.userId,
    action: "USER_DELETED",
    entityType: "User",
    entityId: id,
    details: { email: user.email, fullName: user.fullName },
  });

  return Response.json({ ok: true });
}

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
