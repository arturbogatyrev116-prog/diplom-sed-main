"use client";

export default function GlobalError() {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-6">
          <div className="w-full rounded-lg border bg-card p-6">
            <div className="text-lg font-semibold">Что-то пошло не так</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Произошла непредвиденная ошибка. Обновите страницу и попробуйте снова.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

