import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { generateKeyPairAndCertificate } from "@/lib/crypto/keygen";
import { logAuditEvent } from "@/server/audit/log-event";
import { CERTIFICATE_GENERATED } from "@/server/audit/constants-signature";

export const runtime = "nodejs";

export async function POST() {
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

  try {
    // Генерация ключевой пары и сертификата
    const { privateKeyPem, certificatePem, privateKeyPath, certificatePath } =
      generateKeyPairAndCertificate({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
      });

    // Логирование (пути ключей скрыты от клиента)
    await logAuditEvent({
      actorId: user.id,
      action: CERTIFICATE_GENERATED,
      entityType: "Certificate",
      entityId: user.id,
      details: {
        certificatePath,
        privateKeyPath,
      },
    });

    return Response.json(
      {
        ok: true,
        certificate: certificatePem,
        privateKey: privateKeyPem,
        message: "Сертификат успешно сгенерирован",
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
