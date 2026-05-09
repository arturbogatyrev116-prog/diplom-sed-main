"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApprovalStepStatus,
  DocumentStatus,
  UserRole,
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import {
  parseApprovalDecisionFromFormData,
  parseArchiveDocumentFromFormData,
  parseSubmitForApprovalFromFormData,
} from "@/lib/validation/approval";
import {
  APPROVAL_DECISION_DENIED,
  DOCUMENT_APPROVED,
  DOCUMENT_ARCHIVE_DENIED,
  DOCUMENT_ARCHIVED,
  DOCUMENT_REJECTED,
  DOCUMENT_RETURNED_FOR_REVISION,
  DOCUMENT_SUBMIT_DENIED,
  DOCUMENT_SUBMITTED_FOR_APPROVAL,
} from "@/server/audit/constants";
import { logAuditEvent } from "@/server/audit/log-event";
import { canArchiveDocument, canSubmitForApproval, parseDocumentSubject, toPolicyDoc } from "@/server/policies/document";
import { canDecideApproval } from "@/server/policies/approval";

export type WorkflowActionState =
  | { ok: true }
  | { ok: false; error: string };

function deny(msg = "Действие запрещено."): WorkflowActionState {
  return { ok: false, error: msg };
}

export async function submitDocumentForApproval(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return deny("Требуется вход в систему.");

  const parsed = parseSubmitForApprovalFromFormData(formData);
  if (!parsed.success) return deny("Некорректный запрос.");

  const { documentId, approverId } = parsed.data;

  let successDetails: { approverId: string; stepId: string } | null = null;
  let deniedReason: string | null = null;

  try {
    successDetails = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null },
        select: { id: true, authorId: true, status: true, deletedAt: true },
      });

      if (!doc || !canSubmitForApproval(subject, toPolicyDoc(doc))) {
        deniedReason = "policy";
        throw new Error("DENIED");
      }

      // Проверяем, что выбранный согласующий существует и является активным MANAGER
      const approver = await tx.user.findFirst({
        where: {
          id: approverId,
          isActive: true,
          role: UserRole.MANAGER,
        },
        select: { id: true },
      });

      if (!approver) {
        deniedReason = "no_approver_available";
        throw new Error("DENIED");
      }

      const existingRoute = await tx.approvalRoute.findUnique({
        where: { documentId },
        select: {
          id: true,
          steps: { select: { stepOrder: true } },
        },
      });

      if (doc.status === DocumentStatus.DRAFT) {
        if (existingRoute) {
          deniedReason = "invalid_state";
          throw new Error("DENIED");
        }

        const route = await tx.approvalRoute.create({
          data: { documentId },
          select: { id: true },
        });

        const step = await tx.approvalStep.create({
          data: {
            routeId: route.id,
            approverId: approver.id,
            stepOrder: 1,
            status: ApprovalStepStatus.PENDING,
          },
          select: { id: true },
        });

        await tx.document.update({
          where: { id: documentId },
          data: { status: DocumentStatus.ON_APPROVAL },
        });

        return { approverId: approver.id, stepId: step.id };
      }

      if (doc.status === DocumentStatus.REVISION_REQUIRED) {
        if (!existingRoute) {
          deniedReason = "invalid_state";
          throw new Error("DENIED");
        }

        const nextOrder =
          existingRoute.steps.length === 0
            ? 1
            : Math.max(...existingRoute.steps.map((s) => s.stepOrder)) + 1;

        const step = await tx.approvalStep.create({
          data: {
            routeId: existingRoute.id,
            approverId: approver.id,
            stepOrder: nextOrder,
            status: ApprovalStepStatus.PENDING,
          },
          select: { id: true },
        });

        await tx.document.update({
          where: { id: documentId },
          data: { status: DocumentStatus.ON_APPROVAL },
        });

        return { approverId: approver.id, stepId: step.id };
      }

      deniedReason = "policy";
      throw new Error("DENIED");
    });
  } catch {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_SUBMIT_DENIED,
      entityType: "Document",
      entityId: documentId,
      details: { reason: deniedReason ?? "unknown" },
    });
    if (deniedReason === "no_approver_available") {
      return deny("Нет доступных менеджеров для согласования.");
    }
    return deny("Не удалось отправить документ на согласование.");
  }

  await logAuditEvent({
    actorId: subject.userId,
    action: DOCUMENT_SUBMITTED_FOR_APPROVAL,
    entityType: "Document",
    entityId: documentId,
    details: {
      approverId: successDetails!.approverId,
      stepId: successDetails!.stepId,
      status: DocumentStatus.ON_APPROVAL,
    },
  });

  revalidatePath("/outbox");
  revalidatePath("/pending-sign");
  revalidatePath("/inbox");
  revalidatePath("/documents");
  revalidatePath(`/documents/${parsed.data.documentId}`);
  redirect(`/documents/${parsed.data.documentId}`);
}

export async function decideApprovalStep(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return deny("Требуется вход в систему.");

  const parsed = parseApprovalDecisionFromFormData(formData);
  if (!parsed.success) return deny("Некорректный запрос.");

  const { stepId, decision, comment } = parsed.data;
  let decided: { documentId: string; newStatus: DocumentStatus; auditAction: "approved" | "rejected" | "returned" } | null =
    null;
  let deniedReason: string | null = null;

  try {
    decided = await prisma.$transaction(async (tx) => {
      const step = await tx.approvalStep.findUnique({
        where: { id: stepId },
        select: {
          id: true,
          approverId: true,
          status: true,
          route: {
            select: {
              document: {
                select: { id: true, status: true, deletedAt: true },
              },
            },
          },
        },
      });

      const doc = step?.route.document;
      if (!step || !doc) {
        deniedReason = "not_found";
        throw new Error("DENIED");
      }

      if (!canDecideApproval(subject, step, doc)) {
        deniedReason = "policy";
        throw new Error("DENIED");
      }

      const decidedAt = new Date();

      if (decision === "APPROVE") {
        await tx.approvalStep.update({
          where: { id: stepId },
          data: {
            status: ApprovalStepStatus.APPROVED,
            decidedAt,
            comment: null,
          },
        });

        await tx.document.update({
          where: { id: doc.id },
          data: { status: DocumentStatus.APPROVED },
        });
        return {
          documentId: doc.id,
          newStatus: DocumentStatus.APPROVED,
          auditAction: "approved" as const,
        };
      }

      if (decision === "REJECT") {
        await tx.approvalStep.update({
          where: { id: stepId },
          data: {
            status: ApprovalStepStatus.REJECTED,
            decidedAt,
            comment: null,
          },
        });

        await tx.document.update({
          where: { id: doc.id },
          data: { status: DocumentStatus.REJECTED },
        });
        return {
          documentId: doc.id,
          newStatus: DocumentStatus.REJECTED,
          auditAction: "rejected" as const,
        };
      }

      const trimmed = (comment ?? "").trim();
      if (trimmed.length === 0) {
        deniedReason = "comment_required";
        throw new Error("DENIED");
      }

      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: ApprovalStepStatus.RETURNED_FOR_REVISION,
          decidedAt,
          comment: trimmed,
        },
      });

      const docUpdate = await tx.document.updateMany({
        where: {
          id: doc.id,
          deletedAt: null,
          status: DocumentStatus.ON_APPROVAL,
        },
        data: { status: DocumentStatus.REVISION_REQUIRED },
      });
      if (docUpdate.count !== 1) {
        deniedReason = "document_status_update_mismatch";
        throw new Error("DENIED");
      }

      return {
        documentId: doc.id,
        newStatus: DocumentStatus.REVISION_REQUIRED,
        auditAction: "returned" as const,
      };
    });
  } catch {
    await logAuditEvent({
      actorId: subject.userId,
      action: APPROVAL_DECISION_DENIED,
      entityType: "ApprovalStep",
      entityId: stepId,
      details: { reason: deniedReason ?? "unknown" },
    });
    return deny("Не удалось выполнить действие.");
  }

  const auditDetails = { stepId, decision, status: decided!.newStatus };
  if (decided!.auditAction === "approved") {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_APPROVED,
      entityType: "Document",
      entityId: decided!.documentId,
      details: auditDetails,
    });
  } else if (decided!.auditAction === "rejected") {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_REJECTED,
      entityType: "Document",
      entityId: decided!.documentId,
      details: auditDetails,
    });
  } else {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_RETURNED_FOR_REVISION,
      entityType: "Document",
      entityId: decided!.documentId,
      details: { ...auditDetails, hasComment: true },
    });
  }

  revalidatePath("/pending-sign");
  revalidatePath("/outbox");
  revalidatePath("/inbox", "page");
  revalidatePath("/archive");
  revalidatePath(`/documents/${decided!.documentId}`, "page");
  redirect("/pending-sign");
}

export async function archiveDocument(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) return deny("Требуется вход в систему.");

  const parsed = parseArchiveDocumentFromFormData(formData);
  if (!parsed.success) return deny("Некорректный запрос.");

  const { documentId } = parsed.data;
  let deniedReason: string | null = null;

  if (subject.role !== UserRole.OWNER) {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_ARCHIVE_DENIED,
      entityType: "Document",
      entityId: documentId,
      details: { reason: "role" },
    });
    return deny("Не удалось архивировать документ.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null },
        select: { id: true, authorId: true, status: true, deletedAt: true },
      });

      if (!doc || !canArchiveDocument(subject, toPolicyDoc(doc))) {
        deniedReason = "archive_policy";
        throw new Error("DENIED");
      }

      await tx.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });
    });
  } catch {
    await logAuditEvent({
      actorId: subject.userId,
      action: DOCUMENT_ARCHIVE_DENIED,
      entityType: "Document",
      entityId: documentId,
      details: { reason: deniedReason ?? "unknown" },
    });
    return deny("Не удалось архивировать документ.");
  }

  await logAuditEvent({
    actorId: subject.userId,
    action: DOCUMENT_ARCHIVED,
    entityType: "Document",
    entityId: documentId,
    details: { status: DocumentStatus.ARCHIVED },
  });

  revalidatePath("/archive");
  redirect("/archive");
}

