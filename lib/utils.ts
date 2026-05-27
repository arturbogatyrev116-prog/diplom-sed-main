import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveUserName(
  relation: { fullName: string } | null | undefined,
  snapshot: string | null | undefined,
): string {
  return relation?.fullName ?? snapshot ?? "Удалённый пользователь";
}
