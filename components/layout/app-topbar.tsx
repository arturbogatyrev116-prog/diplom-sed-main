import Link from "next/link";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { LogoutButton } from "@/components/layout/logout-button";

type AppTopbarProps = {
  fullName: string;
  email: string;
  role: string;
};

export function AppTopbar({ fullName, email, role }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            СЭД
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-semibold">СЭД</div>
            <div className="text-xs text-muted-foreground">прототип</div>
          </div>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
        <div className="hidden min-w-0 text-right text-sm md:block">
          <div className="truncate font-medium">{fullName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {role} · <span className="font-normal">{email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
