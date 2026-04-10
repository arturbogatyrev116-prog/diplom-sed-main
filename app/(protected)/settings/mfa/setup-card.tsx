"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupResponse = {
  secret: string;
  otpauthUri: string;
};

export function MfaSetupCard() {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generateSecret() {
    setBusy(true);
    setMessage(null);
    setCode("");

    try {
      const res = await fetch("/api/mfa/setup", { method: "POST" });
      if (!res.ok) {
        setMessage("Не удалось сгенерировать секрет");
        return;
      }
      const data = (await res.json()) as SetupResponse;
      setSetup(data);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!setup) return;

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/mfa/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code }),
      });

      if (res.ok) {
        setMessage("MFA включена");
        return;
      }

      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "Не удалось включить MFA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" onClick={generateSecret} disabled={busy}>
        {setup ? "Сгенерировать заново" : "Сгенерировать секрет"}
      </Button>

      {setup ? (
        <div className="space-y-3 rounded-md border bg-background p-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Secret</div>
            <code className="block select-all rounded bg-muted px-3 py-2 text-xs">{setup.secret}</code>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">otpauth URI</div>
            <code className="block select-all break-all rounded bg-muted px-3 py-2 text-xs">{setup.otpauthUri}</code>
          </div>
        </div>
      ) : null}

      {setup ? (
        <div className="space-y-2">
          <Label htmlFor="mfaCode">Код из приложения</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="button" onClick={confirm} disabled={busy || code.trim().length === 0}>
            Подтвердить и включить MFA
          </Button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

