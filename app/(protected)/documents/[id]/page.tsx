import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { DOCUMENT_VIEW_DENIED, DOCUMENT_VIEWED } from "@/server/audit/constants";
import { logDocumentAccessDenied } from "@/server/audit/log-document-access-denied";
import { logAuditEvent } from "@/server/audit/log-event";
import {
  canSubmitForApproval,
  canUpdateDocument,
  canEditDocument,
  canViewDocument,
  canViewDocumentAsAdminReadOnly,
  canViewDocumentForSigning,
  parseDocumentSubject,
  toPolicyDoc,
} from "@/server/policies/document";
import { getActiveDocumentById, getDocumentSignatureInfo } from "@/server/documents/queries";
import { hasDocumentSignature } from "@/lib/crypto/sign";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import {
  getLatestReturnedForRevisionStep,
  hasPendingApprovalForApprover,
  listEligibleApprovers,
} from "@/server/workflows/approval/queries";
import { SubmitForApprovalForm } from "@/components/workflows/submit-for-approval-form";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Свежие данные из БД после workflow (в т.ч. RETURN → REVISION_REQUIRED). */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject) {
    notFound();
  }
  if (
    subject.role !== "EMPLOYEE" &&
    subject.role !== "MANAGER" &&
    subject.role !== "OWNER" &&
    subject.role !== "ADMIN"
  ) {
    notFound();
  }

  const doc = await getActiveDocumentById(id);
  if (!doc) {
    notFound();
  }

  const policyDoc = toPolicyDoc(doc);
  const canViewAsOwner = canViewDocument(subject, policyDoc);
  const canViewAsApprover =
    subject.role === "MANAGER" &&
    doc.status === "ON_APPROVAL" &&
    (await hasPendingApprovalForApprover({ documentId: doc.id, approverId: subject.userId }));
  const canViewAsAdmin = canViewDocumentAsAdminReadOnly(subject, policyDoc);
  const canViewAsSigner = canViewDocumentForSigning(subject, policyDoc);

  if (!canViewAsOwner && !canViewAsApprover && !canViewAsAdmin && !canViewAsSigner) {
    await logDocumentAccessDenied({
      actorId: subject.userId,
      action: DOCUMENT_VIEW_DENIED,
      entityId: id,
      details: { check: "policy" },
    });
    notFound();
  }

  await logAuditEvent({
    actorId: subject.userId,
    action: DOCUMENT_VIEWED,
    entityType: "Document",
    entityId: doc.id,
    details: {
      versionNumber: doc.currentVersion,
      status: doc.status,
    },
  });

  const showEdit = canViewAsOwner && canEditDocument(subject, policyDoc);
  const showSubmit = canViewAsOwner && canSubmitForApproval(subject, policyDoc);
  const approvers = showSubmit ? await listEligibleApprovers({ excludeUserId: doc.authorId }) : [];
  const revisionStep =
    canViewAsOwner && doc.status === DocumentStatus.REVISION_REQUIRED
      ? await getLatestReturnedForRevisionStep(doc.id)
      : null;

  // Подписание: OWNER, APPROVED, не подписан
  const alreadySigned = hasDocumentSignature(doc.id);
  const showSignButton =
    subject.role === "OWNER" &&
    doc.status === DocumentStatus.APPROVED &&
    !alreadySigned;

  // Информация о подписи (если документ подписан)
  const signatureInfo = alreadySigned ? await getDocumentSignatureInfo(doc.id) : null;

  const backHref =
    canViewAsAdmin && !canViewAsOwner
      ? "/archive"
      : canViewAsSigner && !canViewAsOwner
        ? "/pending-sign"
        : canViewAsOwner && subject.role === "OWNER"
          ? "/dashboard"
          : "/documents";
  const backLabel =
    canViewAsAdmin && !canViewAsOwner
      ? "← К архиву"
      : canViewAsSigner && !canViewAsOwner
        ? "← К подписанию ЭЦП"
        : canViewAsOwner && subject.role === "OWNER"
          ? "← На главную"
          : "← К списку";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
        {showEdit ? (
          <Button size="sm" asChild>
            <Link href={`/documents/${doc.id}/edit`}>Редактировать</Link>
          </Button>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {DOCUMENT_TYPE_LABELS[doc.type]} · {DOCUMENT_STATUS_LABELS[doc.status]} · версия {doc.currentVersion}
        </p>
      </div>

      {revisionStep?.decidedAt && revisionStep.approver ? (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Возврат на доработку</CardTitle>
            <CardDescription>
              {revisionStep.approver.fullName} · {dateFmt.format(revisionStep.decidedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{revisionStep.comment ?? "—"}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Реквизиты</CardTitle>
          <CardDescription>Автор и даты</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Автор</div>
            <div className="font-medium">{doc.author.fullName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Создан</div>
            <div>{dateFmt.format(doc.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Обновлён</div>
            <div>{dateFmt.format(doc.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>

      {showSubmit ? (
        <Card>
          <CardHeader>
            <CardTitle>Отправка на подпись</CardTitle>
            <CardDescription>
              {doc.status === DocumentStatus.REVISION_REQUIRED
                ? "После отправки документ снова поступит выбранному подписанту."
                : "Документ будет переведён в статус «На согласовании» и появится у подписанта."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubmitForApprovalForm documentId={doc.id} approvers={approvers} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Содержимое</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">{doc.content}</pre>
        </CardContent>
      </Card>

      {showSignButton ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Электронная подпись</CardTitle>
            <CardDescription>
              Документ утверждён и готов к подписанию. После подписания содержимое будет зафиксировано.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignDocumentButton documentId={doc.id} />
          </CardContent>
        </Card>
      ) : alreadySigned ? (
        <Card className={signatureInfo?.verification.valid !== false ? "border-green-500/40" : "border-destructive/40"}>
          <CardHeader>
            <CardTitle className={signatureInfo?.verification.valid !== false ? "text-green-600 dark:text-green-400" : "text-destructive"}>
              {signatureInfo?.verification.valid !== false ? "✓ Документ подписан ЭЦП" : "✕ Подпись невалидна"}
            </CardTitle>
            <CardDescription>
              {signatureInfo?.verification.valid !== false
                ? "Электронная подпись верифицирована. Содержимое зафиксировано."
                : signatureInfo?.verification.error ?? "Ошибка верификации"}
            </CardDescription>
          </CardHeader>
          {signatureInfo?.signature ? (
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Подписан</div>
                <div className="font-medium">{signatureInfo.signature.signedBy.fullName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Дата подписи</div>
                <div>{dateFmt.format(signatureInfo.signature.signedAt)}</div>
              </div>
              {signatureInfo.verification.signerCommonName ? (
                <div>
                  <div className="text-xs text-muted-foreground">Сертификат</div>
                  <div className="font-medium">{signatureInfo.verification.signerCommonName}</div>
                </div>
              ) : null}
              {signatureInfo.verification.signingTime ? (
                <div>
                  <div className="text-xs text-muted-foreground">Время CMS</div>
                  <div>{dateFmt.format(signatureInfo.verification.signingTime)}</div>
                </div>
              ) : null}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Версии</CardTitle>
          <CardDescription>История снимков при создании и правках черновика</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {doc.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет записей версий.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {doc.versions.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-col gap-0.5 rounded-md border border-border/80 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">
                    Версия {v.versionNumber}: {v.titleSnapshot}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {v.createdBy.fullName} · {dateFmt.format(v.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
