import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { logAuditEvent } from "@/server/audit/log-event";
import { LOGOUT_SUCCESS } from "@/server/audit/constants";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const session = await auth();
        await logAuditEvent({
          actorId: session?.user?.id ?? null,
          action: LOGOUT_SUCCESS,
          entityType: "User",
          entityId: session?.user?.id ?? null,
        });
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button type="submit" variant="outline" size="sm">
        Выйти
      </Button>
    </form>
  );
}
