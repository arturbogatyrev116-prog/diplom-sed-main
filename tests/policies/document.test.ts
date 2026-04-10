import { describe, expect, it } from "vitest";
import { DocumentStatus, UserRole } from "@prisma/client";
import {
  canCreateDocument,
  canEditDocument,
  canUpdateDocument,
  canViewDocument,
  canViewDocumentAsAdminReadOnly,
} from "@/server/policies/document";

describe("document policy", () => {
  const subjectEmployee = { userId: "u1", role: UserRole.EMPLOYEE };
  const subjectOwner = { userId: "ow", role: UserRole.OWNER };
  const subjectAdmin = { userId: "adm", role: UserRole.ADMIN };
  const subjectAdminAsAuditor = { userId: "u1", role: UserRole.ADMIN };

  it("allows create for EMPLOYEE and denies for ADMIN", () => {
    expect(canCreateDocument(subjectEmployee)).toBe(true);
    expect(canCreateDocument(subjectAdmin)).toBe(false);
  });

  it("allows view only for owner and active document", () => {
    const docOwnedActive = { authorId: "u1", status: DocumentStatus.DRAFT, deletedAt: null };
    const docForeignActive = { authorId: "u2", status: DocumentStatus.DRAFT, deletedAt: null };
    const docOwnedDeleted = { authorId: "u1", status: DocumentStatus.DRAFT, deletedAt: new Date() };

    expect(canViewDocument(subjectEmployee, docOwnedActive)).toBe(true);
    expect(canViewDocument(subjectEmployee, docForeignActive)).toBe(false);
    expect(canViewDocument(subjectEmployee, docOwnedDeleted)).toBe(false);
  });

  it("allows edit/update only for owner + DRAFT or REVISION_REQUIRED + active + non-ADMIN", () => {
    const subjectOwnerDraft = { userId: "u1", role: UserRole.OWNER };
    const docDraftOwned = { authorId: "u1", status: DocumentStatus.DRAFT, deletedAt: null };
    const docRevisionOwned = { authorId: "u1", status: DocumentStatus.REVISION_REQUIRED, deletedAt: null };
    const docApprovedOwned = { authorId: "u1", status: DocumentStatus.APPROVED, deletedAt: null };
    const docDraftForeign = { authorId: "u2", status: DocumentStatus.DRAFT, deletedAt: null };

    expect(canEditDocument(subjectEmployee, docDraftOwned)).toBe(true);
    expect(canUpdateDocument(subjectEmployee, docDraftOwned)).toBe(true);
    expect(canEditDocument(subjectOwnerDraft, docDraftOwned)).toBe(true);
    expect(canUpdateDocument(subjectOwnerDraft, docDraftOwned)).toBe(true);

    expect(canEditDocument(subjectEmployee, docRevisionOwned)).toBe(true);
    expect(canUpdateDocument(subjectEmployee, docRevisionOwned)).toBe(true);

    expect(canEditDocument(subjectEmployee, docApprovedOwned)).toBe(false);
    expect(canEditDocument(subjectEmployee, docDraftForeign)).toBe(false);

    expect(canEditDocument(subjectAdminAsAuditor, docDraftOwned)).toBe(false);
    expect(canUpdateDocument(subjectAdminAsAuditor, docDraftOwned)).toBe(false);
  });

  it("allows admin read-only view only for finalized statuses", () => {
    const approved = { authorId: "u2", status: DocumentStatus.APPROVED, deletedAt: null };
    const rejected = { authorId: "u2", status: DocumentStatus.REJECTED, deletedAt: null };
    const archived = { authorId: "u2", status: DocumentStatus.ARCHIVED, deletedAt: null };
    const signed = { authorId: "u2", status: DocumentStatus.SIGNED, deletedAt: null };
    const draft = { authorId: "u2", status: DocumentStatus.DRAFT, deletedAt: null };
    const onApproval = { authorId: "u2", status: DocumentStatus.ON_APPROVAL, deletedAt: null };
    const revision = { authorId: "u2", status: DocumentStatus.REVISION_REQUIRED, deletedAt: null };

    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, approved)).toBe(true);
    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, rejected)).toBe(true);
    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, archived)).toBe(true);
    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, signed)).toBe(true);

    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, draft)).toBe(false);
    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, onApproval)).toBe(false);
    expect(canViewDocumentAsAdminReadOnly(subjectAdmin, revision)).toBe(false);

    expect(canViewDocumentAsAdminReadOnly(subjectEmployee, approved)).toBe(false);
    expect(canViewDocumentAsAdminReadOnly(subjectOwner, approved)).toBe(false);
  });
});

