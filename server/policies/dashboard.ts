import { UserRole } from "@prisma/client";

export type DashboardTile = {
  title: string;
  href: string;
  hint: string;
};

const ALL_TILES: DashboardTile[] = [
  { title: "Документы", href: "/documents", hint: "Список и карточки" },
  { title: "Входящие", href: "/inbox", hint: "Входящий поток" },
  { title: "На подпись", href: "/pending-sign", hint: "Очередь подписания" },
  { title: "Исходящие", href: "/outbox", hint: "Отправленные" },
  { title: "Архив", href: "/archive", hint: "Завершённые дела" },
  { title: "Поиск", href: "/search", hint: "Поиск по реестру" },
  { title: "Аудит", href: "/audit", hint: "Журнал действий" },
];

/**
 * Возвращает плитки дашборда, доступные для данной роли.
 *
 * Модель доступа:
 * - EMPLOYEE, MANAGER: документы, входящие, исходящие, поиск
 * - OWNER: + на подпись, архив
 * - ADMIN: архив, аудит, поиск
 */
export function getDashboardTiles(role: UserRole | null): DashboardTile[] {
  if (!role) return [];

  switch (role) {
    case UserRole.EMPLOYEE:
    case UserRole.MANAGER:
      return ALL_TILES.filter((t) =>
        ["/documents", "/inbox", "/outbox", "/search"].includes(t.href),
      );

    case UserRole.OWNER:
      return ALL_TILES.filter((t) =>
        ["/documents", "/inbox", "/pending-sign", "/outbox", "/archive", "/search"].includes(t.href),
      );

    case UserRole.ADMIN:
      return ALL_TILES.filter((t) =>
        ["/archive", "/search", "/audit"].includes(t.href),
      );

    default:
      return [];
  }
}
