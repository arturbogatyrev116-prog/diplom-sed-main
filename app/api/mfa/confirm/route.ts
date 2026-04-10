import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { verify } from "otplib";
import { logAuditEvent } from "@/server/audit/log-event";
import { MFA_ENABLED } from "@/server/audit/constants";

export const runtime = "nodejs";

type Body = {
  secret?: unknown;
  code?: unknown;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!secret || !code) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await verify({ secret, token: code });
  if (!result.valid) {
    return Response.json({ error: "Неверный код" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
      mfaSecret: secret,
      mfaVerifiedAt: new Date(),
    },
  });

  await logAuditEvent({
    actorId: session.user.id,
    action: MFA_ENABLED,
    entityType: "User",
    entityId: session.user.id,
    details: {
      mfaEnabled: true,
    },
  });

  return Response.json({ ok: true }, { status: 200 });
}

