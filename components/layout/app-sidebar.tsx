"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Inbox, PenLine, Send, Archive, Search, Shield, History } from "lucide-react";

type AppSidebarProps = {
  showAudit?: boolean;
  showArchive?: boolean;
  showDocuments?: boolean;
  showInbox?: boolean;
  showOutbox?: boolean;
  showPendingSign?: boolean;
};

export function AppSidebar({
  showAudit = false,
  showArchive = true,
  showDocuments = true,
  showInbox = true,
  showOutbox = true,
  showPendingSign = true,
}: AppSidebarProps) {
  const pathname = usePathname();

  const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(showDocuments ? [{ href: "/documents", label: "Мои документы", icon: FileText }] : []),
    ...(showInbox ? [{ href: "/inbox", label: "Входящие", icon: Inbox }] : []),
    ...(showPendingSign ? [{ href: "/pending-sign", label: "На подпись", icon: PenLine }] : []),
    ...(showOutbox ? [{ href: "/outbox", label: "Исходящие", icon: Send }] : []),
    ...(showArchive ? [{ href: "/archive", label: "Архив", icon: Archive }] : []),
    { href: "/search", label: "Поиск", icon: Search },
    { href: "/settings/mfa", label: "Настройки MFA", icon: Shield },
    ...(showAudit ? [{ href: "/audit", label: "Аудит", icon: History }] : []),
  ] as const;

  return (
    <aside className="flex w-full shrink-0 flex-col border-b bg-card md:w-56 md:border-b-0 md:border-r">
      <nav className="flex flex-1 gap-0.5 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors md:whitespace-normal",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
