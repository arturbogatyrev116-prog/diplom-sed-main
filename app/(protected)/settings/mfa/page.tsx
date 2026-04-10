import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaSetupCard } from "./setup-card";
import { CertificateCard } from "./certificate-card";

export default function MfaSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки безопасности</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Управление двухфакторной аутентификацией и электронной подписью.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Подключение приложения-аутентификатора</CardTitle>
          <CardDescription>Сгенерируйте секрет и подтвердите первым кодом.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSetupCard />
        </CardContent>
      </Card>

      <CertificateCard />
    </div>
  );
}
