/**
 * Одноразовый офлайн-скрипт: документы со шагом RETURNED_FOR_REVISION,
 * но Document.status всё ещё ON_APPROVAL → REVISION_REQUIRED.
 *
 * Запуск: npx dotenv-cli -e .env -- npx tsx scripts/repair-document-status-after-return.ts
 */
/// <reference types="node" />
import { prisma } from "../lib/db/prisma";
import { ApprovalStepStatus, DocumentStatus } from "@prisma/client";

async function main() {
  const returnedSteps = await prisma.approvalStep.findMany({
    where: { status: ApprovalStepStatus.RETURNED_FOR_REVISION },
    select: { route: { select: { documentId: true } } },
  });

  const documentIds = [...new Set(returnedSteps.map((s) => s.route.documentId))];

  let repaired = 0;
  for (const documentId of documentIds) {
    const { count } = await prisma.document.updateMany({
      where: {
        id: documentId,
        deletedAt: null,
        status: DocumentStatus.ON_APPROVAL,
      },
      data: { status: DocumentStatus.REVISION_REQUIRED },
    });
    repaired += count;
  }

  console.log(`repair-document-status-after-return: updated ${repaired} document row(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
