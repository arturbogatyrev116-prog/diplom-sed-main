"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseDocumentSubject } from "@/server/policies/document";

const createUserSchema = z.object({
  email: z.string().email("Некорректный email"),
  fullName: z.string().min(2, "Минимум 2 символа").max(100),
  role: z.nativeEnum(UserRole),
  password: z.string().min(8, "Минимум 8 символов").max(72),
});

export type CreateUserState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<"email" | "fullName" | "role" | "password", string[]>> };

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const session = await auth();
  const subject = parseDocumentSubject(session);
  if (!subject || subject.role !== UserRole.ADMIN) {
    return { ok: false, error: "Доступ запрещён." };
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Проверьте поля формы.",
      fieldErrors: {
        email: flat.fieldErrors.email,
        fullName: flat.fieldErrors.fullName,
        role: flat.fieldErrors.role,
        password: flat.fieldErrors.password,
      },
    };
  }

  const { email, fullName, role, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "Пользователь с таким email уже существует." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { email, fullName, role, passwordHash, isActive: true },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
