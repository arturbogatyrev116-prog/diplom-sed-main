"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject } from "@/server/policies/document";
import { getActiveDocumentById } from "@/server/documents/queries";
import {
  canViewDocument,
  canViewDocumentAsAdminReadOnly,
  canViewDocumentForSigning,
  toPolicyDoc,
} from "@/server/policies/document";
import {
  hasPendingApprovalForApprover,
  hasAnyApprovalStepForApprover,
} from "@/server/workflows/approval/queries";

export type CommentFormState = { ok: true } | { ok: false; error: string };

export async function addComment(
  documentId: string,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return { ok: false, error: "Требуется вход в систему." };

  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (!content) return { ok: false, error: "Комментарий не может быть пустым." };
  if (content.length > 2000) return { ok: false, error: "Комментарий слишком длинный (макс. 2000 символов)." };

  const doc = await getActiveDocumentById(documentId);
  if (!doc) return { ok: false, error: "Документ не найден." };

  if (doc.status === "ARCHIVED") return { ok: false, error: "Нельзя комментировать архивный документ." };

  const policyDoc = toPolicyDoc(doc);
  const canView =
    canViewDocument(subject, policyDoc) ||
    canViewDocumentAsAdminReadOnly(subject, policyDoc) ||
    canViewDocumentForSigning(subject, policyDoc) ||
    (subject.role === "MANAGER" &&
      (doc.status === "ON_APPROVAL"
        ? await hasPendingApprovalForApprover({ documentId, approverId: subject.userId })
        : await hasAnyApprovalStepForApprover({ documentId, approverId: subject.userId })));

  if (!canView) return { ok: false, error: "Нет доступа к документу." };

  await prisma.comment.create({
    data: { documentId, authorId: subject.userId, content },
  });

  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

export async function deleteComment(
  commentId: string,
  documentId: string,
): Promise<CommentFormState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return { ok: false, error: "Требуется вход в систему." };

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return { ok: false, error: "Комментарий не найден." };

  if (comment.documentId !== documentId) return { ok: false, error: "Комментарий не принадлежит документу." };

  // Only the author or ADMIN can delete
  if (comment.authorId !== subject.userId && subject.role !== "ADMIN") {
    return { ok: false, error: "Нет прав на удаление." };
  }

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}
