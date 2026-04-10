import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentForm } from "@/components/documents/document-form";
import { canCreateDocument, parseDocumentSubject } from "@/server/policies/document";

export default async function NewDocumentPage() {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || !canCreateDocument(subject)) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/documents">← К списку</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новый документ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Черновик будет сохранён от вашего имени.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Параметры</CardTitle>
          <CardDescription>Название, тип и текст документа.</CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
