import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentStatus, DocumentType, UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { parseDocumentSubject } from "@/server/policies/document";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

const fieldBaseClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: PageProps) {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) notFound();

  if (subject.role === UserRole.OWNER) {
    notFound();
  }

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const typeParam = typeof params.type === "string" ? params.type : "";
  const statusParam = typeof params.status === "string" ? params.status : "";

  const hasQuery = q.length > 0 || typeParam.length > 0 || statusParam.length > 0;

  const validType = Object.values(DocumentType).includes(typeParam as DocumentType)
    ? (typeParam as DocumentType)
    : undefined;
  const validStatus = Object.values(DocumentStatus).includes(statusParam as DocumentStatus)
    ? (statusParam as DocumentStatus)
    : undefined;

  // Фильтр по роли: ADMIN видит все, остальные — только свои
  const authorFilter =
    subject.role === UserRole.ADMIN ? {} : { authorId: subject.userId };

  const docs = hasQuery
    ? await prisma.document.findMany({
        where: {
          ...authorFilter,
          deletedAt: null,
          ...(q ? { title: { contains: q } } : {}),
          ...(validType ? { type: validType } : {}),
          ...(validStatus ? { status: validStatus } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { fullName: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поиск</h1>
        <p className="mt-1 text-sm text-muted-foreground">Поиск по реестру документов.</p>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Название документа..."
          className={`${fieldBaseClass} max-w-xs`}
        />
        <select name="type" defaultValue={typeParam} className={`${fieldBaseClass} max-w-[200px]`}>
          <option value="">Все типы</option>
          {Object.values(DocumentType).map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusParam} className={`${fieldBaseClass} max-w-[200px]`}>
          <option value="">Все статусы</option>
          {Object.values(DocumentStatus).map((s) => (
            <option key={s} value={s}>
              {DOCUMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">Найти</Button>
        {hasQuery ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">Сбросить</Link>
          </Button>
        ) : null}
      </form>

      {hasQuery ? (
        docs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Ничего не найдено</CardTitle>
              <CardDescription>Попробуйте изменить параметры поиска.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">Найдено: {docs.length}</p>
            {docs.map((d) => (
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
                <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Автор</div>
                    <div className="font-medium">{d.author.fullName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Создан</div>
                    <div>{dateFmt.format(d.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Обновлён</div>
                    <div>{dateFmt.format(d.updatedAt)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Введите параметры поиска</CardTitle>
            <CardDescription>Укажите название, тип или статус документа.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
