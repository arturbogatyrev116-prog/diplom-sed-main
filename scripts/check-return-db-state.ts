import { prisma } from "../lib/db/prisma";
import { ApprovalStepStatus } from "@prisma/client";

async function main() {
  const steps = await prisma.approvalStep.findMany({
    where: { status: ApprovalStepStatus.RETURNED_FOR_REVISION },
    orderBy: { decidedAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      comment: true,
      decidedAt: true,
      route: {
        select: {
          documentId: true,
          document: { select: { id: true, status: true } },
        },
      },
    },
  });

  for (const s of steps) {
    const d = s.route.document;
    console.log(
      JSON.stringify({
        stepId: s.id,
        stepStatus: s.status,
        commentLen: s.comment?.length ?? 0,
        documentId: d.id,
        documentStatus: d.status,
      }),
    );
  }

  if (steps.length === 0) {
    console.log("NO_RETURNED_STEPS: no rows with RETURNED_FOR_REVISION in DB");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
