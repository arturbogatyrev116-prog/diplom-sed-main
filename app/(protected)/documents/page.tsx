import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import {
  canCreateDocument,
  canSeeDocumentsList,
  parseDocumentSubject,
} from "@/server/policies/document";
import { listDocumentsForUser } from "@/server/documents/queries";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function DocumentsPage() {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || !canSeeDocumentsList(subject)) {
    notFound();
  }

  const documents = await listDocumentsForUser(subject.userId);
  const showCreate = canCreateDocument(subject);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Мои документы</h1>
          <p className="mt-1 text-sm text-muted-foreground">Документы, созданные и доступные только вам.</p>
        </div>
        {showCreate ? (
          <Button asChild>
            <Link href="/documents/new">Создать документ</Link>
          </Button>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока нет документов</CardTitle>
            <CardDescription>
              {showCreate
                ? "Создайте первый документ, чтобы увидеть его в списке."
                : "Создание документов для вашей роли недоступно."}
            </CardDescription>
          </CardHeader>
          {showCreate ? (
            <CardContent>
              <Button asChild>
                <Link href="/documents/new">Создать документ</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Список</CardTitle>
            <CardDescription>{documents.length} шт.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Создан</th>
                  <th className="px-4 py-3">Обновлён</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/documents/${d.id}`} className="text-primary underline-offset-4 hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</td>
                    <td className="px-4 py-3">{DOCUMENT_STATUS_LABELS[d.status]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{dateFmt.format(d.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{dateFmt.format(d.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/documents/${d.id}`}>Открыть</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
