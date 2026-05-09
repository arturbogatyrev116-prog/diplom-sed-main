import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { generateKeyPairAndCertificate, hasUserCertificate, getCertificateInfo } from "@/lib/crypto/keygen";
import { logAuditEvent } from "@/server/audit/log-event";
import { CERTIFICATE_GENERATED } from "@/server/audit/constants-signature";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const info = getCertificateInfo(session.user.id);
  if (!info) {
    return Response.json({ exists: false }, { status: 200 });
  }

  return Response.json({ exists: true, info }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, fullName: true, isActive: true },
  });

  if (!user?.isActive) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch { /* нет тела — force остаётся false */ }

  if (!force && hasUserCertificate(user.id)) {
    return Response.json({ error: "Сертификат уже существует. Передайте force: true для перевыпуска." }, { status: 409 });
  }

  try {
    const { privateKeyPem, certificatePem, privateKeyPath, certificatePath } =
      generateKeyPairAndCertificate({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
      });

    await logAuditEvent({
      actorId: user.id,
      action: CERTIFICATE_GENERATED,
      entityType: "Certificate",
      entityId: user.id,
      details: {
        certificatePath,
        privateKeyPath,
        reissue: force,
      },
    });

    return Response.json(
      {
        ok: true,
        certificate: certificatePem,
        privateKey: privateKeyPem,
        message: force ? "Сертификат перевыпущен" : "Сертификат успешно сгенерирован",
      },
      { status: 200 },
    );
  } catch {
    return Response.json(
      { error: "Не удалось сгенерировать сертификат" },
      { status: 500 },
    );
  }
}
