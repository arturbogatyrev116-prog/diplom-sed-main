import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canSeeAuditLog, parseAuditSubject } from "@/server/policies/audit";
import { listLatestAuditEvents, countAuditEvents } from "@/server/audit/queries";
import { Pagination } from "@/components/ui/pagination";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditPage({ searchParams }: PageProps) {
  const session = await auth();
  const subject = parseAuditSubject(session);

  if (!canSeeAuditLog(subject)) {
    notFound();
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [events, total] = await Promise.all([
    listLatestAuditEvents(PAGE_SIZE, offset),
    countAuditEvents(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Аудит</h1>
        <p className="mt-1 text-sm text-muted-foreground">Последние события безопасности и действий.</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Событий пока нет.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Когда</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{dateFmt.format(e.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{e.action}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.entityType}</span>
                      <span className="text-muted-foreground"> · {e.entityId ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {e.actor?.fullName ?? (e.actorId ? `#${e.actorId}` : "—")}
                    </td>
                    <td className="px-4 py-3">
                      <pre className="max-h-28 overflow-auto rounded-md bg-muted/20 p-2 text-xs whitespace-pre-wrap">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseUrl="/audit" />
        </>
      )}
    </div>
  );
}
