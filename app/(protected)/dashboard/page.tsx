import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseUserRole } from "@/server/policies/document";
import { getDashboardTiles } from "@/server/policies/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true, mfaVerifiedAt: true },
  });

  const mfaEnabled = dbUser?.mfaEnabled ?? false;
  const mfaVerifiedAt = dbUser?.mfaVerifiedAt ?? null;

  const role = parseUserRole(session.user.role);
  const tiles = getDashboardTiles(role);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Панель управления</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Добро пожаловать. Реализованы вход по паролю, MFA (TOTP), защита маршрутов и каркас интерфейса для демонстрации.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
            <CardDescription>Данные из сессии</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">ФИО</div>
              <div className="font-medium">{session.user.fullName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{session.user.email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Роль</div>
              <div className="font-medium">{session.user.role}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">User ID</div>
              <div className="font-mono text-xs">{session.user.id}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Безопасность</CardTitle>
            <CardDescription>Статус MFA из базы данных</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">MFA (TOTP)</div>
              <div className="font-medium">{mfaEnabled ? "Включена" : "Не включена"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Подтверждена</div>
              <div className="font-medium">
                {mfaVerifiedAt
                  ? new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(mfaVerifiedAt)
                  : "—"}
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings/mfa">Настройки MFA</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
            <div className="mt-3 text-xs font-medium text-primary">Открыть →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
