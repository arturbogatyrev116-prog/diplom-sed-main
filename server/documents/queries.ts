import { prisma } from "@/lib/db/prisma";
import { verifyCMSSignature, getDocumentSignaturePath } from "@/lib/crypto/sign";
import fs from "fs";

export async function listDocumentsForUser(authorId: string) {
  return prisma.document.findMany({
    where: { authorId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Активный документ по id (без фильтра по автору — проверка прав в policy на странице / в action). */
export async function getActiveDocumentById(id: string) {
  return prisma.document.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, fullName: true, email: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          createdBy: { select: { id: true, fullName: true } },
        },
      },
    },
  });
}

/** Получить информацию о подписи документа с результатом верификации */
export async function getDocumentSignatureInfo(documentId: string) {
  const signature = await prisma.signature.findUnique({
    where: { documentId },
    include: {
      signedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!signature) return null;

  // Верификация подписи
  const signaturePath = getDocumentSignaturePath(documentId);
  if (!signaturePath) {
    return {
      signature,
      verification: { valid: false, error: "Файл подписи не найден" },
    };
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { content: true },
  });

  if (!doc) {
    return {
      signature,
      verification: { valid: false, error: "Документ не найден" },
    };
  }

  const verification = verifyCMSSignature({
    content: doc.content,
    signaturePath,
  });

  return { signature, verification };
}

/** Документы на подпись ЭЦП (APPROVED, без подписи) */
export async function listDocumentsForSigning() {
  const allDocs = await prisma.document.findMany({
    where: { status: "APPROVED", deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { id: true, fullName: true } },
    },
  });

  // Исключаем уже подписанные
  const docIds = allDocs.map((d) => d.id);
  const signedDocIds = await prisma.signature.findMany({
    where: { documentId: { in: docIds } },
    select: { documentId: true },
  });
  const signedSet = new Set(signedDocIds.map((s) => s.documentId));

  return allDocs.filter((d) => !signedSet.has(d.id));
}
