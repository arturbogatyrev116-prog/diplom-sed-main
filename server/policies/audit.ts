import { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

export type AuditSubject = {
  userId: string;
  role: UserRole;
};

function parseUserRole(role: string): UserRole | null {
  const values = Object.values(UserRole) as string[];
  return values.includes(role) ? (role as UserRole) : null;
}

export function parseAuditSubject(session: Session | null): AuditSubject | null {
  const userId = session?.user?.id;
  const roleRaw = session?.user?.role;
  if (!userId || typeof roleRaw !== "string") return null;

  const role = parseUserRole(roleRaw);
  if (!role) return null;

  return { userId, role };
}

export function canSeeAuditLog(subject: AuditSubject | null): boolean {
  return subject?.role === UserRole.ADMIN;
}

