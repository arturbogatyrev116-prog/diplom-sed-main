import { DocumentStatus, UserRole } from "@prisma/client";
import type { Session } from "next-auth";

export type DocumentSubject = {
  userId: string;
  role: UserRole;
};

/** Минимальные поля документа для ABAC (владелец, статус, soft-delete). */
export type DocumentPolicyDoc = {
  authorId: string;
  status: DocumentStatus;
  deletedAt: Date | null;
};

export function parseUserRole(role: string): UserRole | null {
  const values = Object.values(UserRole) as string[];
  return values.includes(role) ? (role as UserRole) : null;
}

export function parseDocumentSubject(session: Session | null): DocumentSubject | null {
  const userId = session?.user?.id;
  const roleRaw = session?.user?.role;
  if (!userId || typeof roleRaw !== "string") {
    return null;
  }
  const role = parseUserRole(roleRaw);
  if (!role) {
    return null;
  }
  return { userId, role };
}

function isActive(doc: Pick<DocumentPolicyDoc, "deletedAt">): boolean {
  return doc.deletedAt == null;
}

function isOwner(subject: DocumentSubject, doc: Pick<DocumentPolicyDoc, "authorId">): boolean {
  return doc.authorId === subject.userId;
}

/** Список документов: все роли из ТЗ могут открывать раздел (данные всё равно только свои). */
export function canSeeDocumentsList(subject: DocumentSubject | null): boolean {
  if (!subject) return false;
  return subject.role === UserRole.EMPLOYEE || subject.role === UserRole.MANAGER || subject.role === UserRole.OWNER;
}

/** Создание: ADMIN запрещён. */
export function canCreateDocument(subject: DocumentSubject | null): boolean {
  if (!subject) return false;
  return subject.role !== UserRole.ADMIN;
}

/** Просмотр карточки: только владелец, не удалён. */
export function canViewDocument(subject: DocumentSubject | null, doc: DocumentPolicyDoc): boolean {
  if (!subject) return false;
  if (!isActive(doc)) return false;
  return isOwner(subject, doc);
}

/**
 * Администратор: read-only просмотр завершённых документов (архивный контур), без author-flow.
 * Не открывает черновики и документы в процессе согласования.
 */
export function canViewDocumentAsAdminReadOnly(
  subject: DocumentSubject | null,
  doc: DocumentPolicyDoc,
): boolean {
  if (!subject) return false;
  if (subject.role !== UserRole.ADMIN) return false;
  if (!isActive(doc)) return false;
  return (
    doc.status === DocumentStatus.APPROVED ||
    doc.status === DocumentStatus.REJECTED ||
    doc.status === DocumentStatus.ARCHIVED ||
    doc.status === DocumentStatus.SIGNED
  );
}

/**
 * Владелец: просмотр документов на подпись ЭЦП (APPROVED, без подписи), чужих.
 */
export function canViewDocumentForSigning(
  subject: DocumentSubject | null,
  doc: DocumentPolicyDoc,
): boolean {
  if (!subject) return false;
  if (subject.role !== UserRole.OWNER) return false;
  if (!isActive(doc)) return false;
  return doc.status === DocumentStatus.APPROVED || doc.status === DocumentStatus.SIGNED;
}

/** Редактирование (UI / страница edit): владелец, черновик или возврат на доработку, не ADMIN. */
export function canEditDocument(subject: DocumentSubject | null, doc: DocumentPolicyDoc): boolean {
  if (!subject) return false;
  if (subject.role === UserRole.ADMIN) return false;
  if (!isActive(doc)) return false;
  if (!isOwner(subject, doc)) return false;
  return (
    doc.status === DocumentStatus.DRAFT || doc.status === DocumentStatus.REVISION_REQUIRED
  );
}

/** Сохранение черновика: те же условия, что и для страницы редактирования. */
export function canUpdateDocument(subject: DocumentSubject | null, doc: DocumentPolicyDoc): boolean {
  return canEditDocument(subject, doc);
}

/** Отправка на подпись: владелец, черновик или повторная отправка после возврата, активный документ, не ADMIN. */
export function canSubmitForApproval(subject: DocumentSubject | null, doc: DocumentPolicyDoc): boolean {
  if (!subject) return false;
  if (subject.role === UserRole.ADMIN) return false;
  if (!isActive(doc)) return false;
  if (!isOwner(subject, doc)) return false;
  return (
    doc.status === DocumentStatus.DRAFT || doc.status === DocumentStatus.REVISION_REQUIRED
  );
}

/** Архивация: OWNER, активный документ, статус завершён. */
export function canArchiveDocument(subject: DocumentSubject | null, doc: DocumentPolicyDoc): boolean {
  if (!subject) return false;
  if (subject.role !== UserRole.OWNER) return false;
  if (!isActive(doc)) return false;
  return doc.status === DocumentStatus.APPROVED || doc.status === DocumentStatus.REJECTED;
}

/**
 * Подписание документа ЭЦП: только OWNER, статус APPROVED или SIGNED, активный документ.
 * Подписать можно только утверждённый документ, который ещё не подписан.
 */
export function canSignDocument(
  subject: DocumentSubject | null,
  doc: DocumentPolicyDoc,
  alreadySigned: boolean,
): boolean {
  if (!subject) return false;
  if (subject.role !== UserRole.OWNER) return false;
  if (!isActive(doc)) return false;
  if (alreadySigned) return false;
  return doc.status === DocumentStatus.APPROVED;
}

export function toPolicyDoc(d: {
  authorId: string;
  status: DocumentStatus;
  deletedAt: Date | null;
}): DocumentPolicyDoc {
  return {
    authorId: d.authorId,
    status: d.status,
    deletedAt: d.deletedAt,
  };
}
