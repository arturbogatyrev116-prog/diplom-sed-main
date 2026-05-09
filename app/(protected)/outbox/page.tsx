import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { parseDocumentSubject } from "@/server/policies/document";
import { listOutboxForAuthor, countOutboxForAuthor } from "@/server/workflows/approval/queries";
import { Pagination } from "@/components/ui/pagination";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OutboxPage({ searchParams }: PageProps) {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) notFound();
  if (subject.role !== "EMPLOYEE" && subject.role !== "MANAGER") {
    notFound();
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [docs, total] = await Promise.all([
    listOutboxForAuthor(subject.userId, PAGE_SIZE, offset),
    countOutboxForAuthor(subject.userId),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Исходящие</h1>
        <p className="mt-1 text-sm text-muted-foreground">Документы, отправленные на согласование.</p>
      </div>

      {total === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока пусто</CardTitle>
            <CardDescription>Отправьте документ на согласование из карточки документа.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {docs.map((d) => {
              const step = d.approvalRoute?.steps?.[0];
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
                      <div className="text-xs text-muted-foreground">Обновлён</div>
                      <div className="font-medium">{dateFmt.format(d.updatedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Согласующий</div>
                      <div className="font-medium">
                        {step?.approver?.fullName ?? "—"} {step?.approver ? `(${step.approver.role})` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Статус шага</div>
                      <div className="font-medium">{step?.status ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Создан</div>
                      <div className="font-medium">{dateFmt.format(d.createdAt)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseUrl="/outbox" />
        </>
      )}
    </div>
  );
}
