import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/documents/labels";
import { parseDocumentSubject } from "@/server/policies/document";
import { listPendingSignForApprover } from "@/server/workflows/approval/queries";
import { listDocumentsForSigning } from "@/server/documents/queries";
import { ApprovalDecisionButtons } from "@/components/workflows/decision-buttons";
import { hasDocumentSignature } from "@/lib/crypto/sign";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

export const dynamic = "force-dynamic";

export default async function PendingSignPage() {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) notFound();

  if (subject.role !== UserRole.MANAGER && subject.role !== UserRole.OWNER) {
    notFound();
  }

  // OWNER: документы на подпись ЭЦП
  if (subject.role === UserRole.OWNER) {
    const items = await listDocumentsForSigning();

    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">На подпись ЭЦП</h1>
          <p className="mt-1 text-sm text-muted-foreground">Документы, готовые к подписанию электронной подписью.</p>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Нет документов</CardTitle>
              <CardDescription>Пока нет документов, требующих подписи ЭЦП.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {items.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    <Link href={`/documents/${doc.id}`} className="text-primary hover:underline underline-offset-4">
                      {doc.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {DOCUMENT_STATUS_LABELS[doc.status]}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Автор</div>
                      <div className="font-medium">{doc.author?.fullName ?? doc.authorName ?? "Удалённый пользователь"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Обновлён</div>
                      <div className="font-medium">{dateFmt.format(doc.updatedAt)}</div>
                    </div>
                  </div>
                  <div>
                    <Button variant="default" size="sm" asChild>
                      <Link href={`/documents/${doc.id}`}>Открыть и подписать ЭЦП</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // MANAGER: workflow approval
  const items = await listPendingSignForApprover(subject.userId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">На согласование</h1>
        <p className="mt-1 text-sm text-muted-foreground">Документы, ожидающие вашего решения.</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Нет документов</CardTitle>
            <CardDescription>Пока нет задач на подпись.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((it) => {
            const doc = it.route.document;
            return (
              <Card key={it.id}>
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Автор</div>
                      <div className="font-medium">{doc.author?.fullName ?? doc.authorName ?? "Удалённый пользователь"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Поступило</div>
                      <div className="font-medium">{dateFmt.format(it.createdAt)}</div>
                    </div>
                  </div>
                  <ApprovalDecisionButtons stepId={it.id} />
                  <div className="pt-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/documents/${doc.id}`}>Открыть документ</Link>
                    </Button>
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
