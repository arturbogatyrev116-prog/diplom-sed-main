import { prisma } from "@/lib/db/prisma";

function parseDetailsJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return { value: parsed };
  } catch {
    return { raw };
  }
}

export async function listLatestAuditEvents(limit = 30, offset = 0) {
  const rows = await prisma.auditLog.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      detailsJson: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    details: parseDetailsJson(r.detailsJson),
  }));
}

export async function countAuditEvents() {
  return prisma.auditLog.count();
}

