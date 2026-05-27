import { prisma } from "@/lib/db/prisma";
import { ApprovalStepStatus, DocumentStatus, UserRole } from "@prisma/client";

export async function listEligibleApprovers(options?: { excludeUserId?: string }) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: UserRole.MANAGER,
      ...(options?.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      role: true,
      email: true,
    },
  });
}

export async function hasPendingApprovalForApprover(params: {
  documentId: string;
  approverId: string;
}) {
  const step = await prisma.approvalStep.findFirst({
    where: {
      approverId: params.approverId,
      status: ApprovalStepStatus.PENDING,
      route: {
        documentId: params.documentId,
        document: {
          deletedAt: null,
          status: DocumentStatus.ON_APPROVAL,
        },
      },
    },
    select: { id: true },
  });
  return step != null;
}

/** Проверить, участвовал ли пользователь как согласующий по документу (любой статус шага). */
export async function hasAnyApprovalStepForApprover(params: {
  documentId: string;
  approverId: string;
}) {
  const step = await prisma.approvalStep.findFirst({
    where: {
      approverId: params.approverId,
      route: {
        documentId: params.documentId,
        document: { deletedAt: null },
      },
    },
    select: { id: true },
  });
  return step != null;
}

export async function listInboxRevisionForAuthor(authorId: string, limit = 20, offset = 0) {
  return prisma.document.findMany({
    where: {
      authorId,
      deletedAt: null,
      status: DocumentStatus.REVISION_REQUIRED,
      approvalRoute: {
        is: {
          steps: {
            some: {
              status: ApprovalStepStatus.RETURNED_FOR_REVISION,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      currentVersion: true,
      updatedAt: true,
      approvalRoute: {
        select: {
          steps: {
            where: { status: ApprovalStepStatus.RETURNED_FOR_REVISION },
            orderBy: { decidedAt: "desc" },
            take: 1,
            select: {
              comment: true,
              decidedAt: true,
              approverName: true,
              approver: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
}

export async function countInboxRevisionForAuthor(authorId: string) {
  return prisma.document.count({
    where: {
      authorId,
      deletedAt: null,
      status: DocumentStatus.REVISION_REQUIRED,
      approvalRoute: {
        is: {
          steps: { some: { status: ApprovalStepStatus.RETURNED_FOR_REVISION } },
        },
      },
    },
  });
}

export async function getLatestReturnedForRevisionStep(documentId: string) {
  return prisma.approvalStep.findFirst({
    where: {
      status: ApprovalStepStatus.RETURNED_FOR_REVISION,
      route: { documentId },
    },
    orderBy: { decidedAt: "desc" },
    select: {
      comment: true,
      decidedAt: true,
      approverName: true,
      approver: { select: { fullName: true } },
    },
  });
}

export async function listPendingSignForApprover(approverId: string) {
  return prisma.approvalStep.findMany({
    where: {
      approverId,
      status: ApprovalStepStatus.PENDING,
      route: {
        document: {
          deletedAt: null,
          status: DocumentStatus.ON_APPROVAL,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      route: {
        select: {
          document: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              currentVersion: true,
              createdAt: true,
              updatedAt: true,
              author: {
                select: { id: true, fullName: true, email: true },
              },
              authorName: true,
            },
          },
        },
      },
    },
  });
}

export async function listOutboxForAuthor(authorId: string, limit = 20, offset = 0) {
  return prisma.document.findMany({
    where: {
      authorId,
      deletedAt: null,
      approvalRoute: { isNot: null },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      currentVersion: true,
      createdAt: true,
      updatedAt: true,
      approvalRoute: {
        select: {
          createdAt: true,
          steps: {
            orderBy: { stepOrder: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              stepOrder: true,
              createdAt: true,
              decidedAt: true,
              approver: { select: { id: true, fullName: true, role: true } },
              approverName: true,
            },
          },
        },
      },
    },
  });
}

export async function countOutboxForAuthor(authorId: string) {
  return prisma.document.count({
    where: { authorId, deletedAt: null, approvalRoute: { isNot: null } },
  });
}

export async function listArchiveForAuthor(authorId: string, limit = 20, offset = 0) {
  return prisma.document.findMany({
    where: {
      authorId,
      deletedAt: null,
      status: { in: [DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.ARCHIVED, DocumentStatus.SIGNED] },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      currentVersion: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      author: { select: { id: true, fullName: true, email: true, role: true } },
      authorName: true,
      approvalRoute: {
        select: {
          createdAt: true,
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              status: true,
              decidedAt: true,
              approver: { select: { id: true, fullName: true, role: true } },
              approverName: true,
            },
          },
        },
      },
    },
  });
}

export async function countArchiveForAuthor(authorId: string) {
  return prisma.document.count({
    where: {
      authorId,
      deletedAt: null,
      status: { in: [DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.ARCHIVED, DocumentStatus.SIGNED] },
    },
  });
}

export async function listArchiveForAdmin(limit = 20, offset = 0) {
  return prisma.document.findMany({
    where: {
      deletedAt: null,
      status: { in: [DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.ARCHIVED, DocumentStatus.SIGNED] },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      currentVersion: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      author: { select: { id: true, fullName: true, email: true, role: true } },
      authorName: true,
      approvalRoute: {
        select: {
          createdAt: true,
          steps: {
            orderBy: { stepOrder: "asc" },
            select: {
              status: true,
              decidedAt: true,
              approver: { select: { id: true, fullName: true, role: true } },
              approverName: true,
            },
          },
        },
      },
    },
  });
}


export async function countArchiveForAdmin() {
  return prisma.document.count({
    where: {
      deletedAt: null,
      status: { in: [DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.ARCHIVED, DocumentStatus.SIGNED] },
    },
  });
}
