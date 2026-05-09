import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject, toPolicyDoc, canViewDocument, canViewDocumentForSigning } from "@/server/policies/document";
import { hasPendingApprovalForApprover, hasAnyApprovalStepForApprover } from "@/server/workflows/approval/queries";
import { logAuditEvent } from "@/server/audit/log-event";

export const runtime = "nodejs";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

export async function POST(request: NextRequest) {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const documentId = formData.get("documentId");
  const file = formData.get("file");

  if (typeof documentId !== "string" || !documentId) {
    return Response.json({ error: "documentId обязателен" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Файл обязателен" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Файл превышает 10 МБ" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json({ error: "Недопустимый тип файла" }, { status: 400 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
  });
  if (!doc) return Response.json({ error: "Документ не найден" }, { status: 404 });

  const policyDoc = toPolicyDoc(doc);
  const canViewAsOwner = canViewDocument(subject, policyDoc);
  const canViewAsSigner = canViewDocumentForSigning(subject, policyDoc);
  const canViewAsApprover =
    subject.role === "MANAGER" &&
    (doc.status === "ON_APPROVAL"
      ? await hasPendingApprovalForApprover({ documentId: doc.id, approverId: subject.userId })
      : await hasAnyApprovalStepForApprover({ documentId: doc.id, approverId: subject.userId }));

  if (!canViewAsOwner && !canViewAsSigner && !canViewAsApprover) {
    return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const docDir = path.join(ATTACHMENTS_DIR, documentId);
  const resolvedDocDir = path.resolve(docDir);
  if (!resolvedDocDir.startsWith(path.resolve(ATTACHMENTS_DIR) + path.sep)) {
    return Response.json({ error: "Недопустимый documentId" }, { status: 400 });
  }
  fs.mkdirSync(docDir, { recursive: true });

  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-а-яёА-ЯЁ]/gu, "_");
  const storagePath = path.join(docDir, `${Date.now()}_${safeName}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storagePath, buffer);

  const relPath = path.relative(process.cwd(), storagePath).replace(/\\/g, "/");

  const attachment = await prisma.attachment.create({
    data: {
      documentId,
      filename: file.name,
      storagePath: relPath,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById: subject.userId,
    },
  });

  await logAuditEvent({
    actorId: subject.userId,
    action: "ATTACHMENT_UPLOADED",
    entityType: "Attachment",
    entityId: attachment.id,
    details: { documentId, filename: file.name, sizeBytes: file.size },
  });

  return Response.json({ ok: true, attachment }, { status: 201 });
}
