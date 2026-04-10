"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signDocument } from "@/server/documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PenTool, CheckCircle, AlertCircle } from "lucide-react";

type SignDocumentButtonProps = {
  documentId: string;
};

export function SignDocumentButton({ documentId }: SignDocumentButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSign = async () => {
    setIsPending(true);
    setError(null);

    try {
      const result = await signDocument(documentId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Произошла непредвиденная ошибка");
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle className="size-4 shrink-0" />
        Документ подписан ЭЦП
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2">
          <PenTool className="size-4" />
          Подписать ЭЦП
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подписание документа</DialogTitle>
          <DialogDescription>
            Вы собираетесь подписать этот документ электронной подписью (CMS/PKCS#7).
            После подписания содержимое будет зафиксировано, а статус изменится на «Подписан».
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
            Отмена
          </Button>
          <Button onClick={handleSign} disabled={isPending}>
            {isPending ? "Подписание..." : "Подписать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
