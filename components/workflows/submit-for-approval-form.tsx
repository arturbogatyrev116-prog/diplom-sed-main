"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { submitDocumentForApproval, type WorkflowActionState } from "@/server/workflows/approval/actions";

type Approver = { id: string; fullName: string; email: string };

const initialState: WorkflowActionState = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Отправка…" : "Отправить на согласование"}
    </Button>
  );
}

export function SubmitForApprovalForm({
  documentId,
  approvers,
}: {
  documentId: string;
  approvers: Approver[];
}) {
  const [state, formAction] = React.useActionState(submitDocumentForApproval, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />

      {approvers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет доступных менеджеров для согласования.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="approverId" className="text-sm font-medium">
            Согласующий
          </label>
          <select
            id="approverId"
            name="approverId"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
          >
            {approvers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {!state.ok ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {approvers.length > 0 && <SubmitButton />}
    </form>
  );
}
