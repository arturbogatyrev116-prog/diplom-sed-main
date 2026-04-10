"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { archiveDocument, type WorkflowActionState } from "@/server/workflows/approval/actions";

const initialState: WorkflowActionState = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Архивировать"}
    </Button>
  );
}

export function ArchiveButton({ documentId }: { documentId: string }) {
  const [state, action] = React.useActionState(archiveDocument, initialState);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="documentId" value={documentId} />
      {!state.ok ? <div className="text-xs text-destructive">{state.error}</div> : null}
      <SubmitButton />
    </form>
  );
}

