"use client";

import { useState } from "react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Сотрудник",
  MANAGER: "Менеджер",
  OWNER: "Владелец",
  ADMIN: "Администратор",
};

type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};

export function UserRow({ user: initial, currentUserId }: { user: User; currentUserId: string }) {
  const [user, setUser] = useState(initial);
  const [loading, setLoading] = useState(false);
  const isSelf = user.id === currentUserId;

  const patch = async (data: Partial<{ isActive: boolean; role: UserRole }>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) setUser(json.user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">{user.fullName}</td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="text-sm">{ROLE_LABELS[user.role]}</span>
        ) : (
          <select
            value={user.role}
            disabled={loading || isSelf}
            onChange={(e) => patch({ role: e.target.value as UserRole })}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring"
          >
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm font-medium ${user.isActive ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {user.isActive ? "Активен" : "Деактивирован"}
        </span>
      </td>
      <td className="px-4 py-3">
        {!isSelf ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => patch({ isActive: !user.isActive })}
          >
            {user.isActive ? "Деактивировать" : "Активировать"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Вы</span>
        )}
      </td>
    </tr>
  );
}
