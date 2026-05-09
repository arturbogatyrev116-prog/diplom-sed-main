"use client";

import { useActionState } from "react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createUser, type CreateUserState } from "@/server/admin/user-actions";

const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Сотрудник",
  MANAGER: "Менеджер",
  OWNER: "Владелец",
  ADMIN: "Администратор",
};

const initialState: CreateUserState = { ok: true };

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-fullName" className="text-sm font-medium">ФИО</label>
        <input
          id="cu-fullName"
          name="fullName"
          type="text"
          required
          maxLength={100}
          placeholder="Иван Иванов"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        {!state.ok && state.fieldErrors?.fullName && (
          <p className="text-xs text-destructive">{state.fieldErrors.fullName[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-email" className="text-sm font-medium">Email</label>
        <input
          id="cu-email"
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        {!state.ok && state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-role" className="text-sm font-medium">Роль</label>
        <select
          id="cu-role"
          name="role"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {Object.values(UserRole).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {!state.ok && state.fieldErrors?.role && (
          <p className="text-xs text-destructive">{state.fieldErrors.role[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cu-password" className="text-sm font-medium">Пароль</label>
        <input
          id="cu-password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          placeholder="Минимум 8 символов"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
        {!state.ok && state.fieldErrors?.password && (
          <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="sm:col-span-2 flex flex-col gap-2">
        {!state.ok && !state.fieldErrors && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state.ok && (
          <p className="text-sm text-green-600 dark:text-green-400">Пользователь создан.</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Создание..." : "Создать пользователя"}
          </Button>
        </div>
      </div>
    </form>
  );
}
