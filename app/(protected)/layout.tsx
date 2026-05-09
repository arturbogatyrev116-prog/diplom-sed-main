import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { canSeeAuditLog, parseAuditSubject } from "@/server/policies/audit";
import { parseDocumentSubject } from "@/server/policies/document";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const auditSubject = parseAuditSubject(session);
  const showAudit = canSeeAuditLog(auditSubject);
  const docSubject = parseDocumentSubject(session);
  const role = docSubject?.role;
  const showArchive = role === "ADMIN" || role === "OWNER";
  const showDocuments = role === "EMPLOYEE" || role === "MANAGER";
  const showOutbox = role === "EMPLOYEE" || role === "MANAGER";
  const showInbox = role === "EMPLOYEE" || role === "MANAGER";
  const showPendingSign = role === "MANAGER" || role === "OWNER";

  const showUsers = role === "ADMIN";
  const showSearch = role === "EMPLOYEE" || role === "MANAGER" || role === "ADMIN";

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppTopbar
        fullName={session.user.fullName}
        email={session.user.email ?? ""}
        role={session.user.role}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          showAudit={showAudit}
          showArchive={showArchive}
          showDocuments={showDocuments}
          showInbox={showInbox}
          showOutbox={showOutbox}
          showPendingSign={showPendingSign}
          showUsers={showUsers}
          showSearch={showSearch}
          role={role}
        />
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
