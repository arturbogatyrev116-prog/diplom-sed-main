import { DocumentStatus, DocumentType } from "@prisma/client";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.CONTRACT]: "Договор",
  [DocumentType.ORDER]: "Приказ / распоряжение",
  [DocumentType.STATEMENT]: "Заявление",
  [DocumentType.INVOICE]: "Счёт",
  [DocumentType.MEMO]: "Служебная записка",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.DRAFT]: "Черновик",
  [DocumentStatus.ON_APPROVAL]: "На согласовании",
  [DocumentStatus.REVISION_REQUIRED]: "Доработка",
  [DocumentStatus.APPROVED]: "Согласован",
  [DocumentStatus.REJECTED]: "Отклонён",
  [DocumentStatus.SIGNED]: "Подписан",
  [DocumentStatus.ARCHIVED]: "В архиве",
};
