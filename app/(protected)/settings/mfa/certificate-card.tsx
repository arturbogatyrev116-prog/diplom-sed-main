"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Download, CheckCircle, AlertCircle } from "lucide-react";

export function CertificateCard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificate, setCertificate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Не удалось сгенерировать сертификат");
        return;
      }

      const data = await res.json();
      setCertificate(data.certificate);
      setGenerated(true);
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!certificate) return;
    const blob = new Blob([certificate], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certificate.pem";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5 shrink-0" />
          Электронная подпись (ЭЦП)
        </CardTitle>
        <CardDescription>
          Самоподписанный X.509 сертификат для подписания документов. Храните приватный ключ в безопасности.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {generated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="size-4 shrink-0" />
              Сертификат успешно сгенерирован
            </div>
            <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              Скачать сертификат (.pem)
            </Button>
            <p className="text-xs text-muted-foreground">
              Приватный ключ сохранён на сервере. Для полноценной ЭЦП скачайте и храните его в безопасном месте.
              (В демонстрационных целях ключ не выдаётся.)
            </p>
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Генерация..." : "Сгенерировать сертификат"}
          </Button>
        )}

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Что это значит?</p>
          <p className="mt-1">
            Самоподписанный сертификат создаёт уникальную электронную подпись для вашего аккаунта. Администратор
            сможет подписывать утверждённые документы, создавая CMS-подпись (PKCS#7), которая гарантирует
            неизменность содержимого и подтверждает авторство.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
