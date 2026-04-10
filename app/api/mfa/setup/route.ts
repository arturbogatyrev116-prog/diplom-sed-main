import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { generateSecret, generateURI } from "otplib";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isActive: true },
  });

  if (!user?.isActive) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = generateSecret();
  const otpauthUri = generateURI({
    issuer: "Diplom SED",
    label: user.email,
    secret,
  });

  return Response.json({ secret, otpauthUri }, { status: 200 });
}

