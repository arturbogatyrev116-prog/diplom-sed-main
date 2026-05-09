import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject, toPolicyDoc, canViewDocument, canViewDocumentForSigning, canViewDocumentAsAdminReadOnly } from "@/server/policies/document";
import { hasPendingApprovalForApprover, hasAnyApprovalStepForApprover } from "@/server/workflows/approval/queries";

export const runtime = "nodejs";

const ATTACHMENTS_DIR = path.join(process.cwd(), "data", "attachments");

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      document: true,
    },
  });

  if (!attachment) return Response.json({ error: "Вложение не найдено" }, { status: 404 });

  const doc = attachment.document;
  const policyDoc = toPolicyDoc(doc);

  const canViewAsOwner = canViewDocument(subject, policyDoc);
  const canViewAsAdmin = canViewDocumentAsAdminReadOnly(subject, policyDoc);
  const canViewAsSigner = canViewDocumentForSigning(subject, policyDoc);
  const canViewAsApprover =
    subject.role === "MANAGER" &&
    (doc.status === "ON_APPROVAL"
      ? await hasPendingApprovalForApprover({ documentId: doc.id, approverId: subject.userId })
      : await hasAnyApprovalStepForApprover({ documentId: doc.id, approverId: subject.userId }));

  if (!canViewAsOwner && !canViewAsAdmin && !canViewAsSigner && !canViewAsApprover) {
    return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const fullPath = path.join(process.cwd(), attachment.storagePath);
  const resolvedPath = path.resolve(fullPath);
  if (!resolvedPath.startsWith(path.resolve(ATTACHMENTS_DIR) + path.sep)) {
    return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  }
  if (!fs.existsSync(fullPath)) {
    return Response.json({ error: "Файл не найден на сервере" }, { status: 404 });
  }

  const buffer = fs.readFileSync(fullPath);
  return new Response(buffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { document: true },
  });

  if (!attachment) return Response.json({ error: "Вложение не найдено" }, { status: 404 });

  const policyDoc = toPolicyDoc(attachment.document);
  if (!canViewDocument(subject, policyDoc)) {
    return Response.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  if (attachment.document.status !== "DRAFT" && attachment.document.status !== "REVISION_REQUIRED") {
    return Response.json({ error: "Нельзя удалять вложения документа в текущем статусе" }, { status: 403 });
  }

  // Удаляем файл с диска
  const fullPath = path.join(process.cwd(), attachment.storagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await prisma.attachment.delete({ where: { id } });

  return Response.json({ ok: true });
}
