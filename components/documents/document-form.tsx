"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { DocumentType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { cn } from "@/lib/utils";
import {
  createDocument,
  updateDocument,
  type DocumentFormState,
} from "@/server/documents/actions";

const initialState: DocumentFormState = { ok: true };

const fieldBaseClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Сохранение…" : label}
    </Button>
  );
}

type DocumentFormProps =
  | {
      mode: "create";
      defaultValues?: undefined;
    }
  | {
      mode: "edit";
      documentId: string;
      defaultValues: {
        title: string;
        type: DocumentType;
        content: string;
      };
    };

function fieldError(state: DocumentFormState, key: "title" | "type" | "content") {
  if (state.ok) return null;
  const msgs = state.fieldErrors?.[key];
  if (!msgs?.length) return null;
  return <p className="text-xs text-destructive">{msgs.join(" ")}</p>;
}

export function DocumentForm(props: DocumentFormProps) {
  const boundUpdate =
    props.mode === "edit"
      ? updateDocument.bind(null, props.documentId)
      : null;

  const action = props.mode === "create" ? createDocument : boundUpdate!;

  const [state, formAction] = React.useActionState(action, initialState);

  const defaults =
    props.mode === "edit"
      ? props.defaultValues
      : { title: "", type: DocumentType.MEMO, content: "" };

  return (
    <form action={formAction} className="space-y-6">
      {!state.ok && state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={500}
          defaultValue={defaults.title}
          aria-invalid={!state.ok && !!state.fieldErrors?.title?.length}
        />
        {fieldError(state, "title")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Тип документа</Label>
        <select
          id="type"
          name="type"
          required
          defaultValue={defaults.type}
          className={cn(fieldBaseClass, "h-8")}
          aria-invalid={!state.ok && !!state.fieldErrors?.type?.length}
        >
          {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {fieldError(state, "type")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Содержимое</Label>
        <textarea
          id="content"
          name="content"
          required
          rows={12}
          defaultValue={defaults.content}
          className={cn(fieldBaseClass, "min-h-[200px] resize-y")}
          aria-invalid={!state.ok && !!state.fieldErrors?.content?.length}
        />
        {fieldError(state, "content")}
      </div>

      <div className="flex gap-2">
        <SubmitButton label={props.mode === "create" ? "Создать документ" : "Сохранить изменения"} />
      </div>
    </form>
  );
}
