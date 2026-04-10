"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitDocumentForApproval, type WorkflowActionState } from "@/server/workflows/approval/actions";

const initialState: WorkflowActionState = { ok: true };

const fieldBaseClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Отправка…" : "Отправить на подпись"}
    </Button>
  );
}

type ApproverItem = {
  id: string;
  fullName: string;
  role: UserRole;
  email: string | null;
};

export function SubmitForApprovalForm({
  documentId,
  approvers,
}: {
  documentId: string;
  approvers: ApproverItem[];
}) {
  const [state, formAction] = React.useActionState(submitDocumentForApproval, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="documentId" value={documentId} />

      {!state.ok ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="approverId">
            Подписант (MANAGER/ADMIN)
          </label>
          <select
            id="approverId"
            name="approverId"
            required
            className={cn(fieldBaseClass, "h-8")}
            defaultValue={approvers[0]?.id ?? ""}
          >
            {approvers.length === 0 ? (
              <option value="" disabled>
                Нет доступных подписантов
              </option>
            ) : (
              approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} ({a.role})
                </option>
              ))
            )}
          </select>
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}

