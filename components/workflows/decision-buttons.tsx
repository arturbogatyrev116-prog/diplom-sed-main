"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { decideApprovalStep, type WorkflowActionState } from "@/server/workflows/approval/actions";

const initialState: WorkflowActionState = { ok: true };

const fieldBaseClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

function ActionButton({ label, variant }: { label: string; variant: "default" | "destructive" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function ApprovalDecisionButtons({ stepId }: { stepId: string }) {
  const [state, action] = React.useActionState(decideApprovalStep, initialState);

  return (
    <div className="space-y-4">
      {!state.ok ? <div className="text-xs text-destructive">{state.error}</div> : null}
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="decision" value="APPROVE" />
          <ActionButton label="Согласовать" variant="default" />
        </form>
        <form action={action}>
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="decision" value="REJECT" />
          <ActionButton label="Отклонить" variant="destructive" />
        </form>
      </div>
      <form action={action} className="space-y-2 rounded-md border border-border/80 bg-muted/10 p-3">
        <input type="hidden" name="stepId" value={stepId} />
        <input type="hidden" name="decision" value="RETURN" />
        <Label htmlFor={`return-comment-${stepId}`}>Вернуть на доработку</Label>
        <p className="text-xs text-muted-foreground">Комментарий обязателен: автор увидит его во «Входящих» и в карточке документа.</p>
        <textarea
          id={`return-comment-${stepId}`}
          name="comment"
          required
          rows={4}
          className={cn(fieldBaseClass, "min-h-[100px] resize-y")}
          placeholder="Укажите, что нужно исправить…"
        />
        <div>
          <ActionButton label="Вернуть на доработку" variant="secondary" />
        </div>
      </form>
    </div>
  );
}
