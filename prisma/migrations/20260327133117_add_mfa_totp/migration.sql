-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3);
