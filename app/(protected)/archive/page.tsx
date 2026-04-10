import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { parseDocumentSubject, canArchiveDocument } from "@/server/policies/document";
import { listArchiveForAdmin } from "@/server/workflows/approval/queries";
import { ArchiveButton } from "@/components/workflows/archive-button";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function ArchivePage() {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) notFound();

  if (subject.role !== "ADMIN" && subject.role !== "OWNER") {
    notFound();
  }

  const docs = await listArchiveForAdmin();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Архив</h1>
        <p className="mt-1 text-sm text-muted-foreground">Завершённые документы и архив.</p>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока пусто</CardTitle>
            <CardDescription>Здесь появятся документы после решения (APPROVED/REJECTED) и архивации.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {docs.map((d) => {
            const canArchive = canArchiveDocument(subject, { authorId: d.author.id, status: d.status, deletedAt: null });
            const decided = d.approvalRoute?.steps?.[0]?.decidedAt ?? null;
            const decisionStatus = d.approvalRoute?.steps?.[0]?.status ?? null;
            const approverName = d.approvalRoute?.steps?.[0]?.approver.fullName ?? null;

            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    <Link href={`/documents/${d.id}`} className="text-primary hover:underline underline-offset-4">
                      {d.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {DOCUMENT_TYPE_LABELS[d.type]} · {DOCUMENT_STATUS_LABELS[d.status]} · версия {d.currentVersion}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Автор</div>
                    <div className="font-medium">{d.author.fullName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Обновлён</div>
                    <div className="font-medium">{dateFmt.format(d.updatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Архивирован</div>
                    <div className="font-medium">{d.archivedAt ? dateFmt.format(d.archivedAt) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Решение</div>
                    <div className="font-medium">{decisionStatus ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Подписант</div>
                    <div className="font-medium">{approverName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Дата решения</div>
                    <div className="font-medium">{decided ? dateFmt.format(decided) : "—"}</div>
                  </div>
                  <div className="flex items-center justify-end sm:justify-start">
                    {d.status !== DocumentStatus.ARCHIVED && canArchive ? <ArchiveButton documentId={d.id} /> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
