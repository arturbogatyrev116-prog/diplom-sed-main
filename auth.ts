import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { verify } from "otplib";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/server/audit/log-event";
import { LOGIN_SUCCESS } from "@/server/audit/constants";

type SessionUserPayload = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
};

class MFARequiredError extends CredentialsSignin {
  code = "MFA_REQUIRED";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP", type: "text" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const rawTotpField = credentials?.totpCode;
        let rawTotp = "";
        if (rawTotpField === undefined || rawTotpField === null) {
          rawTotp = "";
        } else if (typeof rawTotpField === "string") {
          rawTotp = rawTotpField.trim();
          if (rawTotp === "undefined" || rawTotp === "null") {
            rawTotp = "";
          }
        } else {
          rawTotp = String(rawTotpField).trim();
          if (rawTotp === "undefined" || rawTotp === "null") {
            rawTotp = "";
          }
        }
        const normalizedTotp = rawTotp.replace(/\D/g, "").slice(0, 6);

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            fullName: true,
            passwordHash: true,
            role: true,
            isActive: true,
            mfaEnabled: true,
            mfaSecret: true,
          },
        });

        if (!user?.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (user.mfaEnabled) {
          if (rawTotp === "") {
            throw new MFARequiredError();
          }

          if (normalizedTotp.length !== 6) {
            return null;
          }

          if (!user.mfaSecret) return null;

          try {
            const result = await verify({ secret: user.mfaSecret, token: normalizedTotp });
            if (!result.valid) return null;
          } catch {
            return null;
          }
        }

        void logAuditEvent({
          actorId: user.id,
          action: LOGIN_SUCCESS,
          entityType: "User",
          entityId: user.id,
          details: {
            method: "credentials",
            mfaEnabled: user.mfaEnabled,
          },
          ipAddress: (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          userAgent: (await headers()).get("user-agent") ?? null,
        });

        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as SessionUserPayload;
        token.id = u.id;
        token.email = u.email;
        token.fullName = u.fullName;
        token.role = u.role;
        token.isActive = u.isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.fullName = token.fullName as string;
        session.user.role = token.role as string;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

