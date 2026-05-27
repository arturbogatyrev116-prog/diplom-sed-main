import { prisma } from "@/lib/db/prisma";
import { verifyCMSSignature, getDocumentSignaturePath } from "@/lib/crypto/sign";

export async function listDocumentsForUser(authorId: string, limit = 20, offset = 0) {
  return prisma.document.findMany({
    where: { authorId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
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

export async function countDocumentsForUser(authorId: string) {
  return prisma.document.count({ where: { authorId, deletedAt: null } });
}

/** Активный документ по id (без фильтра по автору — проверка прав в policy на странице / в action). */
export async function getActiveDocumentById(id: string) {
  return prisma.document.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, fullName: true, email: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          titleSnapshot: true,
          contentSnapshot: true,
          createdByName: true,
          createdAt: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          authorName: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, fullName: true } },
        },
      },
      approvalRoute: {
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              id: true,
              stepOrder: true,
              status: true,
              comment: true,
              approverName: true,
              decidedAt: true,
              createdAt: true,
              approver: { select: { id: true, fullName: true, role: true, email: true } },
            },
          },
        },
      },
      attachments: true,
      signature: {
        select: {
          id: true,
          documentId: true,
          signedByName: true,
          contentHash: true,
          signaturePath: true,
          signedAt: true,
          signedBy: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });
}

/** Получить информацию о подписи документа с результатом верификации */
export async function getDocumentSignatureInfo(documentId: string) {
  const signature = await prisma.signature.findUnique({
    where: { documentId },
    select: {
      id: true,
      documentId: true,
      signedById: true,
      signedByName: true,
      contentHash: true,
      signaturePath: true,
      signedAt: true,
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
  return prisma.document.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      signature: null,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      authorName: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, fullName: true } },
    },
  });
}
