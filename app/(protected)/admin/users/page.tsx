import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject } from "@/server/policies/document";
import { UserRole } from "@prisma/client";
import { UserRow } from "./user-row";
import { CreateUserForm } from "./create-user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Сотрудник",
  MANAGER: "Менеджер",
  OWNER: "Владелец",
  ADMIN: "Администратор",
};

export default async function AdminUsersPage() {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || subject.role !== UserRole.ADMIN) notFound();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Управление учётными записями. Всего: {users.length}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новый пользователь</CardTitle>
          <CardDescription>Создать учётную запись вручную</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">ФИО</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} currentUserId={subject.userId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
