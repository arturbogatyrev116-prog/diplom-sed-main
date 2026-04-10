import "dotenv/config";
import { PrismaClient, UserRole, DocumentStatus, DocumentType, ApprovalStepStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { generateKeyPairAndCertificate } from "@/lib/crypto/keygen";
import { createCMSSignature } from "@/lib/crypto/sign";
import { sha256 } from "@/lib/crypto/hash";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEED_PASSWORD_PLAINTEXT = "Password123!";

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD_PLAINTEXT, 12);

  const users = [
    { email: "employee@local.test", fullName: "Иван Сотрудник", role: UserRole.EMPLOYEE },
    { email: "manager@local.test", fullName: "Мария Руководитель", role: UserRole.MANAGER },
    { email: "owner@local.test", fullName: "Алексей Владелец", role: UserRole.OWNER },
    { email: "admin@local.test", fullName: "Ольга Администратор", role: UserRole.ADMIN },
  ];

  const results = [];

  for (const user of users) {
    const entry = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
    });

    results.push(entry);
  }

  return results;
}

async function seedMvpData() {
  const users = await upsertUsers();
  const employee = users.find((u) => u.email === "employee@local.test");
  const manager = users.find((u) => u.email === "manager@local.test");
  const admin = users.find((u) => u.email === "admin@local.test");

  if (!employee || !manager || !admin) {
    throw new Error("Required seed users were not created.");
  }

  const existingDocument = await prisma.document.findFirst({
    where: {
      title: "Тестовый договор поставки",
      authorId: employee.id,
      deletedAt: null,
    },
    select: { id: true },
  });

  const document = existingDocument
    ? await prisma.document.update({
        where: { id: existingDocument.id },
        data: {
          type: DocumentType.CONTRACT,
          status: DocumentStatus.ON_APPROVAL,
          content: "Черновик договора поставки для демонстрации этапа seed.",
          contentHash: "seed-content-hash-v1",
          currentVersion: 1,
          archivedAt: null,
          deletedAt: null,
        },
      })
    : await prisma.document.create({
        data: {
          title: "Тестовый договор поставки",
          type: DocumentType.CONTRACT,
          status: DocumentStatus.ON_APPROVAL,
          content: "Черновик договора поставки для демонстрации этапа seed.",
          contentHash: "seed-content-hash-v1",
          currentVersion: 1,
          authorId: employee.id,
        },
      });

  await prisma.documentVersion.upsert({
    where: {
      documentId_versionNumber: {
        documentId: document.id,
        versionNumber: 1,
      },
    },
    update: {
      titleSnapshot: document.title,
      contentSnapshot: document.content,
      createdById: employee.id,
    },
    create: {
      documentId: document.id,
      versionNumber: 1,
      titleSnapshot: document.title,
      contentSnapshot: document.content,
      createdById: employee.id,
    },
  });

  const route = await prisma.approvalRoute.upsert({
    where: { documentId: document.id },
    update: {},
    create: { documentId: document.id },
  });

  await prisma.approvalStep.upsert({
    where: {
      routeId_stepOrder: {
        routeId: route.id,
        stepOrder: 1,
      },
    },
    update: {
      approverId: manager.id,
      status: ApprovalStepStatus.PENDING,
      comment: null,
      decidedAt: null,
    },
    create: {
      routeId: route.id,
      approverId: manager.id,
      stepOrder: 1,
      status: ApprovalStepStatus.PENDING,
    },
  });

  await prisma.approvalStep.upsert({
    where: {
      routeId_stepOrder: {
        routeId: route.id,
        stepOrder: 2,
      },
    },
    update: {
      approverId: admin.id,
      status: ApprovalStepStatus.PENDING,
      comment: null,
      decidedAt: null,
    },
    create: {
      routeId: route.id,
      approverId: admin.id,
      stepOrder: 2,
      status: ApprovalStepStatus.PENDING,
    },
  });

  const existingComment = await prisma.comment.findFirst({
    where: {
      documentId: document.id,
      authorId: manager.id,
      content: "Документ получен на согласование. Ожидаю финальной редакции.",
    },
    select: { id: true },
  });

  if (!existingComment) {
    await prisma.comment.create({
      data: {
        documentId: document.id,
        authorId: manager.id,
        content: "Документ получен на согласование. Ожидаю финальной редакции.",
      },
    });
  }

  const existingAttachment = await prisma.attachment.findFirst({
    where: {
      documentId: document.id,
      storagePath: "seed/contracts/test-contract-v1.pdf",
    },
    select: { id: true },
  });

  if (!existingAttachment) {
    await prisma.attachment.create({
      data: {
        documentId: document.id,
        filename: "test-contract-v1.pdf",
        storagePath: "seed/contracts/test-contract-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 128000,
        uploadedById: employee.id,
      },
    });
  }

  const existingAuditCreate = await prisma.auditLog.findFirst({
    where: {
      action: "DOCUMENT_CREATED",
      entityType: "Document",
      entityId: document.id,
    },
    select: { id: true },
  });

  if (!existingAuditCreate) {
    await prisma.auditLog.create({
      data: {
        actorId: employee.id,
        action: "DOCUMENT_CREATED",
        entityType: "Document",
        entityId: document.id,
        detailsJson: {
          source: "seed",
          documentTitle: document.title,
          status: document.status,
        },
        ipAddress: "127.0.0.1",
        userAgent: "seed-script",
      },
    });
  }

  const existingAuditApproval = await prisma.auditLog.findFirst({
    where: {
      action: "APPROVAL_ROUTE_CREATED",
      entityType: "ApprovalRoute",
      entityId: route.id,
    },
    select: { id: true },
  });

  if (!existingAuditApproval) {
    await prisma.auditLog.create({
      data: {
        actorId: manager.id,
        action: "APPROVAL_ROUTE_CREATED",
        entityType: "ApprovalRoute",
        entityId: route.id,
        detailsJson: {
          source: "seed",
          stepCount: 2,
        },
      },
    });
  }
}

/**
 * Seed электронной подписи:
 * 1. Генерируем сертификат для admin
 * 2. Меняем статус документа на APPROVED (как будто согласован)
 * 3. Подписываем документ CMS-подписью
 */
async function seedDigitalSignature(ownerId: string, documentId: string) {
  console.log("  → Generating certificate for owner...");

  // 1. Генерация сертификата для OWNER
  const { privateKeyPath, certificatePath } = generateKeyPairAndCertificate({
    userId: ownerId,
    email: "owner@local.test",
    fullName: "Алексей Владелец",
  });

  console.log(`    Certificate: ${certificatePath}`);
  console.log(`    Private key: ${privateKeyPath}`);

  // 2. Меняем статус документа на APPROVED (чтобы можно было подписать)
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, status: true, content: true },
  });

  if (!doc) {
    console.log("  ⚠ Document not found, skipping signature seed");
    return;
  }

  if (doc.status !== DocumentStatus.APPROVED) {
    console.log(`  → Updating document status from ${doc.status} to APPROVED...`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.APPROVED },
    });
  }

  // 3. Проверка, не подписан ли уже
  const existingSignature = await prisma.signature.findUnique({
    where: { documentId },
  });

  if (existingSignature) {
    console.log("  → Document already signed, skipping");
    return;
  }

  // 4. Подписание документа
  console.log("  → Signing document with CMS signature...");
  const contentHash = sha256(doc.content);
  const signaturePath = createCMSSignature({
    content: doc.content,
    privateKeyPath,
    certificatePath,
    documentId,
  });

  const relativeSignaturePath = signaturePath.split("data")[1] ?? signaturePath;

  // 5. Запись в БД
  await prisma.signature.create({
    data: {
      documentId,
      signedById: ownerId,
      contentHash,
      signaturePath: relativeSignaturePath,
    },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.SIGNED },
  });

  console.log("  ✓ Document signed successfully");

  // 6. Audit log
  await prisma.auditLog.create({
    data: {
      actorId: ownerId,
      action: "DOCUMENT_SIGNED",
      entityType: "Document",
      entityId: documentId,
      detailsJson: {
        source: "seed",
        contentHash,
        status: DocumentStatus.SIGNED,
      },
      ipAddress: "127.0.0.1",
      userAgent: "seed-script",
    },
  });
}

async function main() {
  await seedMvpData();

  // Seed цифровой подписи (сертификат для OWNER + подпись документа)
  const owner = await prisma.user.findUnique({
    where: { email: "owner@local.test" },
    select: { id: true },
  });

  const document = await prisma.document.findFirst({
    where: { title: "Тестовый договор поставки" },
    select: { id: true },
  });

  if (owner && document) {
    console.log("\n🔐 Seeding digital signature...");
    await seedDigitalSignature(owner.id, document.id);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

