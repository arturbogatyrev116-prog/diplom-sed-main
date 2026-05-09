"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

type AttachmentsSectionProps = {
  documentId: string;
  initialAttachments: Attachment[];
  canUpload: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function AttachmentsSection({ documentId, initialAttachments, canUpload }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("documentId", documentId);
    formData.append("file", file);

    try {
      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка загрузки");
        return;
      }
      setAttachments((prev) => [...prev, data.attachment]);
    } catch {
      setError("Ошибка сети");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      setError("Ошибка удаления");
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет вложений.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{a.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/api/attachments/${a.id}`} download={a.filename}>
                    <Download className="size-4" />
                  </a>
                </Button>
                {canUpload ? (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="size-4" />
            {uploading ? "Загрузка..." : "Прикрепить файл"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOC, DOCX, PNG, JPG, TXT · до 10 МБ</p>
        </div>
      ) : null}
    </div>
  );
}
