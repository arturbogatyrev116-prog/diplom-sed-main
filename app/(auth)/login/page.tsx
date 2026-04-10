"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center px-6">
        <Card className="w-full">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl tracking-tight">Вход в СЭД</CardTitle>
            <CardDescription>
              Введите учетные данные тестового пользователя. При включённой MFA потребуется одноразовый код из
              приложения-аутентификатора.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();

                setIsPending(true);
                setError(null);

                try {
                  const res = await signIn("credentials", {
                    email,
                    password,
                    ...(mfaRequired ? { totpCode } : {}),
                    redirect: false,
                  });

                  if (!res) {
                    setError("Неверные учетные данные");
                    return;
                  }

                  if (res.code === "MFA_REQUIRED" || (res.error === "CredentialsSignin" && res.code === "MFA_REQUIRED")) {
                    setMfaRequired(true);
                    setTotpCode("");
                    return;
                  }

                  if (res.error) {
                    setError("Неверные учетные данные");
                    return;
                  }

                  router.push("/dashboard");
                } finally {
                  setIsPending(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.ru"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Пароль</Label>
                  <span className="text-sm text-muted-foreground">Забыли пароль?</span>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {mfaRequired ? (
                <div className="space-y-2">
                  <Label htmlFor="totpCode">Код подтверждения</Label>
                  <Input
                    id="totpCode"
                    name="totpCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <p className="text-xs text-muted-foreground">Введите 6‑значный код из приложения-аутентификатора.</p>
                </div>
              ) : null}
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Проверка..." : mfaRequired ? "Подтвердить" : "Войти"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Продолжая, вы соглашаетесь с политикой безопасности организации. (Текст будет добавлен на следующих этапах.)
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

