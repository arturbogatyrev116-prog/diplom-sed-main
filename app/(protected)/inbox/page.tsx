import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/documents/labels";
import { parseDocumentSubject } from "@/server/policies/document";
import { listInboxRevisionForAuthor, countInboxRevisionForAuthor } from "@/server/workflows/approval/queries";
import { Pagination } from "@/components/ui/pagination";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) notFound();

  if (subject.role !== UserRole.EMPLOYEE && subject.role !== UserRole.MANAGER) {
    notFound();
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    listInboxRevisionForAuthor(subject.userId, PAGE_SIZE, offset),
    countInboxRevisionForAuthor(subject.userId),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Входящие</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Документы, возвращённые вам на доработку как автору.
        </p>
      </div>

      {total === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Нет возвратов</CardTitle>
            <CardDescription>Здесь появятся документы со статусом «Доработка» после решения подписанта.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {items.map((doc) => {
              const step = doc.approvalRoute?.steps[0];
              return (
                <Card key={doc.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      <Link href={`/documents/${doc.id}`} className="text-primary hover:underline underline-offset-4">
                        {doc.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {DOCUMENT_TYPE_LABELS[doc.type]} · {DOCUMENT_STATUS_LABELS[doc.status]} · версия {doc.currentVersion}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {step?.decidedAt && step.approver ? (
                      <div className="rounded-md border border-border/80 bg-muted/20 p-3">
                        <div className="text-xs text-muted-foreground">Вернул на доработку</div>
                        <div className="font-medium">{step.approver.fullName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {dateFmt.format(step.decidedAt)}
                        </div>
                        {step.comment ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm">{step.comment}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Комментарий подписанта недоступен.</p>
                    )}
                    <div>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Открыть документ
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseUrl="/inbox" />
        </>
      )}
    </div>
  );
}
