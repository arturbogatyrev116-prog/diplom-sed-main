import { prisma } from "../lib/db/prisma";
import { ApprovalStepStatus, DocumentStatus } from "@prisma/client";

async function main() {
  const inconsistent = await prisma.approvalStep.findFirst({
    where: { status: ApprovalStepStatus.RETURNED_FOR_REVISION },
    select: {
      route: {
        select: {
          document: { select: { id: true, authorId: true, status: true } },
        },
      },
    },
  });

  if (!inconsistent) {
    console.log("no returned steps");
    await prisma.$disconnect();
    return;
  }

  const doc = inconsistent.route.document;
  console.log("sample doc:", doc.id, "authorId", doc.authorId, "status", doc.status);

  const inboxRows = await prisma.document.findMany({
    where: {
      authorId: doc.authorId,
      deletedAt: null,
      status: DocumentStatus.REVISION_REQUIRED,
      approvalRoute: {
        is: {
          steps: {
            some: { status: ApprovalStepStatus.RETURNED_FOR_REVISION },
          },
        },
      },
    },
    select: { id: true, status: true },
  });

  console.log("inbox query count for same author:", inboxRows.length);
  console.log("inbox doc ids:", inboxRows.map((r) => r.id));

  const wouldShowInInbox = inboxRows.some((r) => r.id === doc.id);
  console.log("inconsistent doc appears in inbox query?", wouldShowInInbox);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
