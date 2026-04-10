import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { generateKeyPairAndCertificate, getUserPrivateKeyPath, getUserCertificatePath } from "@/lib/crypto/keygen";
import { createCMSSignature, verifyCMSSignature, hasDocumentSignature, getDocumentSignaturePath } from "@/lib/crypto/sign";
import { sha256 } from "@/lib/crypto/hash";

const TEST_USER_ID = "test-user-sign-001";
const TEST_DOC_ID = "test-doc-001";
const TEST_CONTENT = "Это тестовое содержимое документа для подписания.";

describe("sign & verify", () => {
  const testSignaturesDir = path.join(process.cwd(), "data", "signatures");

  afterEach(() => {
    // Очистка ключей, сертификатов и подписей
    if (fs.existsSync(path.join(process.cwd(), "data", "keys", TEST_USER_ID))) {
      fs.rmSync(path.join(process.cwd(), "data", "keys", TEST_USER_ID), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(process.cwd(), "data", "certs", TEST_USER_ID))) {
      fs.rmSync(path.join(process.cwd(), "data", "certs", TEST_USER_ID), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(testSignaturesDir, `${TEST_DOC_ID}.p7s`))) {
      fs.unlinkSync(path.join(testSignaturesDir, `${TEST_DOC_ID}.p7s`));
    }
  });

  it("создаёт и верифицирует CMS подпись", () => {
    // 1. Генерация ключа и сертификата
    const { privateKeyPath, certificatePath } = generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "signer@example.com",
      fullName: "Signer User",
    });

    // 2. Создание CMS подписи
    const signaturePath = createCMSSignature({
      content: TEST_CONTENT,
      privateKeyPath,
      certificatePath,
      documentId: TEST_DOC_ID,
    });

    expect(fs.existsSync(signaturePath)).toBe(true);

    // 3. Верификация подписи
    const result = verifyCMSSignature({
      content: TEST_CONTENT,
      signaturePath,
    });

    expect(result.valid).toBe(true);
    expect(result.signerCommonName).toBe("Signer User");
    expect(result.signerEmail).toBe("signer@example.com");
    expect(result.signingTime).toBeInstanceOf(Date);
  });

  it("detects изменённый контент (невалидная подпись)", () => {
    const { privateKeyPath, certificatePath } = generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "signer@example.com",
      fullName: "Signer User",
    });

    createCMSSignature({
      content: TEST_CONTENT,
      privateKeyPath,
      certificatePath,
      documentId: TEST_DOC_ID,
    });

    const signaturePath = getDocumentSignaturePath(TEST_DOC_ID)!;

    // Верификация с изменённым контентом
    const result = verifyCMSSignature({
      content: TEST_CONTENT + " ДОПИСАНО",
      signaturePath,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("изменено");
  });

  it("hasDocumentSignature возвращает корректный результат", () => {
    const { privateKeyPath, certificatePath } = generateKeyPairAndCertificate({
      userId: TEST_USER_ID,
      email: "signer@example.com",
      fullName: "Signer User",
    });

    expect(hasDocumentSignature(TEST_DOC_ID)).toBe(false);

    createCMSSignature({
      content: TEST_CONTENT,
      privateKeyPath,
      certificatePath,
      documentId: TEST_DOC_ID,
    });

    expect(hasDocumentSignature(TEST_DOC_ID)).toBe(true);
  });
});

describe("sha256", () => {
  it("вычисляет детерминированный хеш", () => {
    const hash1 = sha256("test content");
    const hash2 = sha256("test content");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
  });

  it("разный контент = разный хеш", () => {
    const hash1 = sha256("content A");
    const hash2 = sha256("content B");
    expect(hash1).not.toBe(hash2);
  });
});
