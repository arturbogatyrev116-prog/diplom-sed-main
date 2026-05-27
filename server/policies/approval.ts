import { ApprovalStepStatus, DocumentStatus, UserRole } from "@prisma/client";
import type { DocumentSubject } from "@/server/policies/document";

export type ApprovalPolicyStep = {
  approverId: string | null;
  status: ApprovalStepStatus;
};

export type ApprovalPolicyDoc = {
  status: DocumentStatus;
  deletedAt: Date | null;
};

export function canDecideApproval(
  subject: DocumentSubject | null,
  step: ApprovalPolicyStep,
  doc: ApprovalPolicyDoc,
): boolean {
  if (!subject) return false;
  if (subject.role !== UserRole.MANAGER) return false;
  if (doc.deletedAt != null) return false;
  if (doc.status !== DocumentStatus.ON_APPROVAL) return false;
  if (step.status !== ApprovalStepStatus.PENDING) return false;
  return step.approverId != null && step.approverId === subject.userId;
}

