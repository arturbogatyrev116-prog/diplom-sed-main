import { UserRole } from "@prisma/client";

export type DashboardTile = {
  title: string;
  href: string;
  hint: string;
};

const ALL_TILES: DashboardTile[] = [
  { title: "Документы", href: "/documents", hint: "Список и карточки" },
  { title: "Входящие", href: "/inbox", hint: "Входящий поток" },
  { title: "На согласование", href: "/pending-sign", hint: "Очередь согласования" },
  { title: "На подпись ЭЦП", href: "/pending-sign", hint: "Документы для подписания ЭЦП" },
  { title: "Исходящие", href: "/outbox", hint: "Отправленные" },
  { title: "Архив", href: "/archive", hint: "Завершённые дела" },
  { title: "Поиск", href: "/search", hint: "Поиск по реестру" },
  { title: "Аудит", href: "/audit", hint: "Журнал действий" },
  { title: "Пользователи", href: "/admin/users", hint: "Управление аккаунтами" },
];

/**
 * Возвращает плитки дашборда, доступные для данной роли.
 *
 * Модель доступа:
 * - EMPLOYEE: документы, входящие, исходящие, поиск
 * - MANAGER: документы, входящие, исходящие, на согласование, поиск
 * - OWNER: на подпись ЭЦП, архив
 * - ADMIN: архив, аудит, поиск, пользователи
 */
export function getDashboardTiles(role: UserRole | null): DashboardTile[] {
  if (!role) return [];

  switch (role) {
    case UserRole.EMPLOYEE:
      return ALL_TILES.filter((t) =>
        ["/documents", "/inbox", "/outbox", "/search"].includes(t.href) &&
        t.title !== "На согласование" && t.title !== "На подпись ЭЦП",
      );

    case UserRole.MANAGER:
      return ALL_TILES.filter((t) =>
        t.title === "Документы" ||
        t.title === "Входящие" ||
        t.title === "Исходящие" ||
        t.title === "На согласование" ||
        t.title === "Поиск",
      );

    case UserRole.OWNER:
      return ALL_TILES.filter((t) =>
        t.title === "На подпись ЭЦП" || t.title === "Архив",
      );

    case UserRole.ADMIN:
      return ALL_TILES.filter((t) =>
        ["/archive", "/search", "/audit", "/admin/users"].includes(t.href) &&
        t.title !== "На согласование" && t.title !== "На подпись ЭЦП",
      );

    default:
      return [];
  }
}
