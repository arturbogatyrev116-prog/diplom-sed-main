import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentForm } from "@/components/documents/document-form";
import { DOCUMENT_EDIT_DENIED } from "@/server/audit/constants";
import { logDocumentAccessDenied } from "@/server/audit/log-document-access-denied";
import { canEditDocument, parseDocumentSubject, toPolicyDoc } from "@/server/policies/document";
import { getActiveDocumentById } from "@/server/documents/queries";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDocumentPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) {
    notFound();
  }
  if (subject.role !== "EMPLOYEE" && subject.role !== "MANAGER") {
    notFound();
  }

  const doc = await getActiveDocumentById(id);
  if (!doc) {
    notFound();
  }

  const policyDoc = toPolicyDoc(doc);
  if (!canEditDocument(subject, policyDoc)) {
    await logDocumentAccessDenied({
      actorId: subject.userId,
      action: DOCUMENT_EDIT_DENIED,
      entityId: id,
      details: { check: "policy" },
    });
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/documents/${doc.id}`}>← К документу</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Редактирование</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Доступно для черновика и для документа, возвращённого на доработку. После сохранения будет создана новая версия.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Параметры</CardTitle>
          <CardDescription>Текущая версия в БД: {doc.currentVersion}</CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentForm
            mode="edit"
            documentId={doc.id}
            defaultValues={{
              title: doc.title,
              type: doc.type,
              content: doc.content,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
