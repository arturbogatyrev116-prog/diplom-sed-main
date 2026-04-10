"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DocumentStatus } from "@prisma/client";
import { auth } from "@/auth";
import {
  DOCUMENT_CREATE_DENIED,
  DOCUMENT_CREATED,
  DOCUMENT_UPDATE_DENIED,
  DOCUMENT_UPDATED,
} from "@/server/audit/constants";
import { DOCUMENT_SIGN_DENIED, DOCUMENT_SIGNED } from "@/server/audit/constants-signature";
import { logAuditEvent } from "@/server/audit/log-event";
import { logDocumentAccessDenied } from "@/server/audit/log-document-access-denied";
import {
  canCreateDocument,
  canUpdateDocument,
  canSignDocument,
  parseDocumentSubject,
  toPolicyDoc,
} from "@/server/policies/document";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentBodyFromFormData } from "@/lib/validation/document";
import { sha256 } from "@/lib/crypto/hash";
import { createCMSSignature, hasDocumentSignature } from "@/lib/crypto/sign";
import { getUserPrivateKeyPath, getUserCertificatePath } from "@/lib/crypto/keygen";

export type DocumentFormState =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<"title" | "type" | "content", string[]>>;
    };

class DocumentMutationBlockedError extends Error {
  constructor() {
    super("DocumentMutationBlocked");
    this.name = "DocumentMutationBlockedError";
  }
}

class DocumentPolicyDeniedError extends Error {
  constructor() {
    super("DocumentPolicyDenied");
    this.name = "DocumentPolicyDeniedError";
  }
}

export async function createDocument(_prev: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Требуется вход в систему." };
  }

  const subject = parseDocumentSubject(session);
  if (!subject) {
    return { ok: false, error: "Не удалось создать документ." };
  }

  if (!canCreateDocument(subject)) {
    await logDocumentAccessDenied({
      actorId: subject.userId,
      action: DOCUMENT_CREATE_DENIED,
      entityId: null,
      details: { check: "role" },
    });
    return { ok: false, error: "Не удалось создать документ." };
  }

  const parsed = parseDocumentBodyFromFormData(formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Проверьте поля формы.",
      fieldErrors: {
        title: flat.fieldErrors.title,
        type: flat.fieldErrors.type,
        content: flat.fieldErrors.content,
      },
    };
  }

  const { title, type, content } = parsed.data;
  const authorId = subject.userId;

  let doc;
  try {
    doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          title,
          type,
          content,
          status: DocumentStatus.DRAFT,
          authorId,
          currentVersion: 1,
        },
      });
      await tx.documentVersion.create({
        data: {
          documentId: created.id,
          versionNumber: 1,
          titleSnapshot: title,
          contentSnapshot: content,
          createdById: authorId,
        },
      });
      return created;
    });
  } catch {
    return { ok: false, error: "Не удалось создать документ." };
  }

  await logAuditEvent({
    actorId: authorId,
    action: DOCUMENT_CREATED,
    entityType: "Document",
    entityId: doc.id,
    details: {
      versionNumber: 1,
      status: DocumentStatus.DRAFT,
      type,
    },
  });

  revalidatePath("/documents");
  redirect(`/documents/${doc.id}`);
}

export async function updateDocument(
  documentId: string,
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Требуется вход в систему." };
  }

  const subject = parseDocumentSubject(session);
  if (!subject) {
    return { ok: false, error: "Не удалось сохранить изменения." };
  }

  const parsed = parseDocumentBodyFromFormData(formData);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Проверьте поля формы.",
      fieldErrors: {
        title: flat.fieldErrors.title,
        type: flat.fieldErrors.type,
        content: flat.fieldErrors.content,
      },
    };
  }

  const { title, type, content } = parsed.data;

  let nextVersion = 1;
  let statusForAudit: DocumentStatus = DocumentStatus.DRAFT;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.document.findFirst({
        where: {
          id: documentId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new DocumentMutationBlockedError();
      }

      if (!canUpdateDocument(subject, toPolicyDoc(existing))) {
        throw new DocumentPolicyDeniedError();
      }

      const nextVersion = existing.currentVersion + 1;

      await tx.document.update({
        where: { id: documentId },
        data: {
          title,
          type,
          content,
          currentVersion: nextVersion,
        },
      });

      await tx.documentVersion.create({
        data: {
          documentId,
          versionNumber: nextVersion,
          titleSnapshot: title,
          contentSnapshot: content,
          createdById: subject.userId,
        },
      });

      return { nextVersion, status: existing.status };
    });
    nextVersion = result.nextVersion;
    statusForAudit = result.status;
  } catch (e) {
    if (e instanceof DocumentPolicyDeniedError) {
      await logDocumentAccessDenied({
        actorId: subject.userId,
        action: DOCUMENT_UPDATE_DENIED,
        entityId: documentId,
        details: { check: "policy" },
      });
      return { ok: false, error: "Не удалось сохранить изменения." };
    }
    if (e instanceof DocumentMutationBlockedError) {
      await logDocumentAccessDenied({
        actorId: subject.userId,
        action: DOCUMENT_UPDATE_DENIED,
        entityId: documentId,
        details: { check: "not_found_or_inactive" },
      });
      return { ok: false, error: "Не удалось сохранить изменения." };
    }
    return { ok: false, error: "Не удалось сохранить изменения." };
  }

  await logAuditEvent({
    actorId: subject.userId,
    action: DOCUMENT_UPDATED,
    entityType: "Document",
    entityId: documentId,
    details: {
      versionNumber: nextVersion,
      status: statusForAudit,
      type,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/inbox");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath(`/documents/${documentId}/edit`);
  redirect(`/documents/${documentId}`);
}

export type SignDocumentState = { ok: true } | { ok: false; error: string };

/**
 * Подписание документа CMS-подписью (ЭЦП).
 * Только OWNER, статус APPROVED, документ ещё не подписан.
 */
export async function signDocument(documentId: string): Promise<SignDocumentState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Требуется вход в систему." };
  }

  const subject = parseDocumentSubject(session);
  if (!subject) {
    return { ok: false, error: "Не удалось подписать документ." };
  }

  // Проверяем, есть ли у пользователя сертификат
  try {
    getUserCertificatePath(subject.userId);
  } catch {
    return { ok: false, error: "Сертификат не найден. Сгенерируйте его в настройках." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null },
      });

      if (!doc) {
        return { denied: true, reason: "not_found" as const };
      }

      // Проверяем, не подписан ли уже
      const existingSignature = await tx.signature.findUnique({
        where: { documentId },
      });

      if (existingSignature) {
        return { denied: true, reason: "already_signed" as const };
      }

      // Политика: ADMIN, APPROVED, не подписан
      if (!canSignDocument(subject, toPolicyDoc(doc), false)) {
        return { denied: true, reason: "policy" as const };
      }

      // 1. Хеш контента
      const contentHash = sha256(doc.content);

      // 2. Пути к ключу и сертификату
      const privateKeyPath = getUserPrivateKeyPath(subject.userId);
      const certificatePath = getUserCertificatePath(subject.userId);

      // 3. Создание CMS подписи
      const signaturePath = createCMSSignature({
        content: doc.content,
        privateKeyPath,
        certificatePath,
        documentId,
      });

      // Относительный путь для хранения в БД
      const relativeSignaturePath = signaturePath.split("data")[1] ?? signaturePath;

      // 4. Запись в БД
      await tx.signature.create({
        data: {
          documentId,
          signedById: subject.userId,
          contentHash,
          signaturePath: relativeSignaturePath,
        },
      });

      // 5. Обновление статуса документа
      await tx.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.SIGNED },
      });

      return { denied: false, contentHash, signaturePath: relativeSignaturePath };
    });

    if (result.denied) {
      await logAuditEvent({
        actorId: subject.userId,
        action: DOCUMENT_SIGN_DENIED,
        entityType: "Document",
        entityId: documentId,
        details: { reason: result.reason },
      });

      if (result.reason === "already_signed") {
        return { ok: false, error: "Документ уже подписан." };
      }
      return { ok: false, error: "Не удалось подписать документ." };
    }

    // Audit log
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_SIGNED,
      entityType: "Document",
      entityId: documentId,
      details: {
        contentHash: result.contentHash,
        status: DocumentStatus.SIGNED,
      },
    });

    revalidatePath("/documents");
    revalidatePath("/archive");
    revalidatePath(`/documents/${documentId}`);

    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось подписать документ." };
  }
}
