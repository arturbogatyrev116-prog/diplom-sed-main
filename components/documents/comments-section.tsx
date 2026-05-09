"use client";

import { useActionState, useRef } from "react";
import { addComment, deleteComment, type CommentFormState } from "@/server/documents/comment-actions";
import { Button } from "@/components/ui/button";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; fullName: string };
};

type Props = {
  documentId: string;
  initialComments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

const initialState: CommentFormState = { ok: true };

export function CommentsSection({ documentId, initialComments, currentUserId, isAdmin }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const boundAction = addComment.bind(null, documentId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  // Reset form on success
  if (state.ok && formRef.current?.querySelector("textarea")?.value) {
    formRef.current.reset();
  }

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId, documentId);
  };

  return (
    <div className="flex flex-col gap-4">
      {initialComments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Комментариев пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {initialComments.map((c) => (
            <li key={c.id} className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{c.author.fullName}</span>
                  <span className="text-xs text-muted-foreground">{dateFmt.format(c.createdAt)}</span>
                </div>
                {(c.author.id === currentUserId || isAdmin) && (
                  <form action={handleDelete.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Удалить
                    </button>
                  </form>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <textarea
          name="content"
          rows={3}
          maxLength={2000}
          placeholder="Написать комментарий..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring resize-none"
          required
        />
        {!state.ok && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Отправка..." : "Отправить"}
          </Button>
        </div>
      </form>
    </div>
  );
}
